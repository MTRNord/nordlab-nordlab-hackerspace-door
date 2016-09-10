/**
 * Main-functionality for handling the Modules :)
 *
 * @main Main
 * @module Main
 * @author Marcel Radzio
 */
//Load needed Features
var request = require('request');
var git = require('simple-git');
var schedule = require('node-schedule');
var argv = require('yargs').argv;
var params_config = require("./configs/ircServer.json");
var autoupdate = params_config["autoupdate"];
var async = require("async");

//LOAD MODULES DOWN HERE
require('./helper/heroku.js');
var pushbullet = require('./handlers/pushbullet.js');
var irc = require('./handlers/irc.js');
var slack = require('./handlers/slack.js');
var getNodes = require('./handlers/getNodes.js');
var telegram = require('./handlers/telegram.js');

//Constants
var SIGINT = "SIGINT";
var door_status2 = "1";


/**
 * Get door-status from the Web
 *
 * @class GetData
 * @return {String} Door Status
 */
function GetData(){
  /**
   * Actual pulled Door Status
   *
   * @property door_status
   * @type String
   */
	request.get('http://www.nordlab-ev.de/doorstate/status.txt', function (error, response, body) {
    	if (!error && response.statusCode == 200) {
    		/**
         * Content of status_page
         *
         * @property body
         * @type String
         */
      	door_status = body;
    	}else{
        /**
         * Fired when an error occurs...
         *
         * @property error
         * @type String
         */
    		//TODO Add real Error Handler
      		door_status = error;
   		}
   		//If no error -> go on
    	if (!error && response.statusCode == 200) {
      		if (door_status2 !== door_status){
      			//Handle first run
        		if (door_status2 !== "1") {
              /**
               * Save Old Door Status
               *
               * @property door_status2
               * @type String
               */
          			door_status2 = door_status;
          			//Translate var's
         			if (door_status == "geschlossen"){
            		door_status = "closed";
         			}else{
            		door_status = "open";
          		}

          		//ADD MODULES DOWN HERE
          		//Call Module send/main Functions
          		pushbullet.pushbulletSend(door_status);
          		//irc.ircSend(door_status);
              return door_status;

        		}else{
        			//Save Last Status
          			door_status2 = door_status;
                return door_status;
        		}
      		}
    	}
    }).setMaxListeners(0);
	//Rerun Function after 10 seconds
	setTimeout(function() { GetData(); }, 10000);
}
//Handle "[CTRL]+[C]"
if (process.platform === "win32") {
	var rl = require("readline").createInterface({
		input: process.stdin,
		output: process.stdout
	}).setMaxListeners(0);
	rl.on(SIGINT, function () {
		process.emit(SIGINT);
	}).setMaxListeners(0);
}
process.on(SIGINT, function () {
	irc.ircStopp();
	process.exit();
}).setMaxListeners(0);

/**
 * Update - Pull last master from Github
 *
 * @method update
 */
function update(){
  git.pull("origin", "master", function(err, update) {
    if(update && update.summary.changes) {
      console.log('Start Update!');
      restart();
    }
  });
}

/**
 * Restart - Restart the Bot completly
 *
 * @method restart
 */
function restart(){
  console.log('Daily restart!');
  irc.ircEndCustom('Restart! Coming back in a few Seconds!');
  require('child_process').exec('npm restart');
}

var j = schedule.scheduleJob('59 3 * * *', function(){
  if (!argv.noupdate && autoupdate == 1) {
    //Run update at 3am and 59min
    update();
  }else{
    restart();
  }
});

//Startup
async.whilst(
  function (callback) {
    // callback has to be called by `uploadImage` when it's done
    irc.ircPreload(callback)
  },
  function (callback) {
    //Activate IRC-Bot Command Handler
    irc.ircBotCommands(callback)
  },
  function (callback) {
    getNodes.saveNodes(callback)
  },
  function (callback) {
    telegram.start(callback)
  },
  function (callback) {
    //Run Mainfunction 20seconds after script start
    setTimeout(function() { GetData(callback); }, 20000)
  },
  function(err, n) {
    if (err) {
      console.log(err)
    }
  }
);