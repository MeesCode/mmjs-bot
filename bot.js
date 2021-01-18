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

function trackToTitle(data){
    if(data.Title.Valid && data.Artist.Valid)
        return `${data.Artist.String} - ${data.Title.String}`
    else
        return data.Path
}

bot.on('message', function (user, userID, channelID, message, evt) {

    if (message.substring(0, 1) == '$') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
       
        args = args.splice(1);
        switch(cmd) {
            case 'help':
                bot.sendMessage({
                    to: channelID,
                    message: 
`\`\`\`$search to perform a search query (max 10)
$add <number> to add a search result to the playlist
$playpause to play or pause
$skip to go to the next song
$queue to see to current queue\`\`\``
                });
            break;

            case 'search':
                fetch(`http://localhost:8080/search?query=${encodeURI(args.join(" "))}`)
                .then(res => res.json())
                .then(data => {
                    if(Object.entries(data).length == 0){
                        bot.sendMessage({
                            to: channelID,
                            message: 'No entries found :('
                        });
                        return
                    }
                    let message = "Add to playlist by entering `$add <number>`: ```"
                    for(let [k, v] of Object.entries(data)){
                        message += `${k}. ${trackToTitle(v)}\n`
                    }
                    bot.sendMessage({
                        to: channelID,
                        message: message+'```'
                    });
                })
                .catch(res => {
                    bot.sendMessage({
                        to: channelID,
                        message: `Something went wrong\n\n${res}`
                    });
                })
            break;
            
            case 'skip':
                fetch('http://localhost:8080/skip')
                .then(res => res.json())
                .then(data => {
                    bot.sendMessage({
                        to: channelID,
                        message: `Now playing: \`\`\`${trackToTitle(data)}\`\`\``
                    });
                })
                .catch(res => {
                    bot.sendMessage({
                        to: channelID,
                        message: `Something went wrong\n\n${res}`
                    });
                })
            break;

            case 'playpause':
                fetch('http://localhost:8080/playpause')
                .then(res => res.json())
                .then(data => {
                    bot.sendMessage({
                        to: channelID,
                        message: `Play/pause while playing: \`\`\`${trackToTitle(data)}\`\`\``
                    });
                    
                })
                .catch(res => {
                    bot.sendMessage({
                        to: channelID,
                        message: `Something went wrong\n\n${res}`
                    });
                })
            break;

            case 'add':
                fetch(`http://localhost:8080/add?query=${encodeURI(args.join(" "))}`)
                .then(res => res.json())
                .then(data => {
                    bot.sendMessage({
                        to: channelID,
                        message: `Added: \`\`\`${trackToTitle(data)}\`\`\``
                    });
                })
                .catch(res => {
                    bot.sendMessage({
                        to: channelID,
                        message: `Something went wrong\n\n${res}`
                    });
                })
            break;

            case 'queue':
                fetch(`http://localhost:8080/queue`)
                .then(res => res.json())
                .then(data => {
                    let message = "now in the queue: ```"
                    for(let [k, v] of Object.entries(data)){
                        if (k == 0) {
                            message += `${k}.\t(playing) ${trackToTitle(v)}\n`
                        } else {
                            message += `${k}.\t${trackToTitle(v)}\n`
                        }
                    }
                    bot.sendMessage({
                        to: channelID,
                        message: message+'```'
                    });
                })
                .catch(res => {
                    bot.sendMessage({
                        to: channelID,
                        message: `Something went wrong\n\n${res}`
                    });
                })
            break;



         }
     }
});