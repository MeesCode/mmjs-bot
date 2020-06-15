var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var fetch = require('node-fetch');
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});
bot.on('message', function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
       
        args = args.splice(1);
        switch(cmd) {
            case 'help':
                bot.sendMessage({
                    to: channelID,
                    message: 
`\`\`\`!search to perform a search query
!add # to add a search result to the playlist
!playplauze to play or pauze
!skip to go to the next song
!queue to see to current queue (max 10 displayed)\`\`\``
                });
            break;

            case 'search':
                fetch(`http://localhost:8080/search?query=${encodeURI(args.join(" "))}`)
                .then(res => res.json())
                .then(data => {
                    let message = "```"
                    for(let [k, v] of Object.entries(data)){
                        if(v.Title.Valid && v.Artist.Valid)
                            message += `${k}. ${v.Artist.String} - ${v.Title.String}\n`
                        else
                            message += `${k}. ${v.Path}\n`
                    }
                    bot.sendMessage({
                        to: channelID,
                        message: message+'```'
                    });
                })
                .catch(res => {
                    bot.sendMessage({
                        to: channelID,
                        message: `something went wrong\n\n${res}`
                    });
                })
            break;
            
            case 'skip':
                fetch('http://localhost:8080/skip')
                .then(res => res.json())
                .then(data => {
                    let message = "now playing: \n```"
                    if(data.Title.Valid && data.Artist.Valid)
                        message += `${data.Artist.String} - ${data.Title.String}\n`
                    else
                        message += `${data.Path}\n`
                    bot.sendMessage({
                        to: channelID,
                        message: message+'```'
                    });
                })
                .catch(res => {
                    bot.sendMessage({
                        to: channelID,
                        message: `something went wrong\n\n${res}`
                    });
                })
            break;

            case 'playpauze':
                fetch('http://localhost:8080/playpauze')
                .then(res => res.text())
                .then(data => {
                    bot.sendMessage({
                        to: channelID,
                        message: data
                    });
                })
                .catch(res => {
                    bot.sendMessage({
                        to: channelID,
                        message: `something went wrong\n\n${res}`
                    });
                })
            break;

            case 'add':
                fetch(`http://localhost:8080/add?query=${encodeURI(args.join(" "))}`)
                .then(res => res.json())
                .then(data => {
                    let message = "added: \n```"
                    if(data.Title.Valid && data.Artist.Valid)
                        message += `${data.Artist.String} - ${data.Title.String}\n`
                    else
                        message += `${data.Path}\n`
                    bot.sendMessage({
                        to: channelID,
                        message: message+'```'
                    });
                })
                .catch(res => {
                    bot.sendMessage({
                        to: channelID,
                        message: `something went wrong\n\n${res}`
                    });
                })
            break;



         }
     }
});