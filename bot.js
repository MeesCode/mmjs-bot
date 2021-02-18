const Discord = require('discord.js')
const auth = require('./auth.json')
const fetch = require('node-fetch')

const client = new Discord.Client()
client.login(auth.token)

const helpMessage = 
`\`$join\` to enter your voice chat
\`$leave\` to leave the voicechat
\`$search <term>\` to perform a search query (max 10)
\`$random\` to get a list of 10 random tracks
\`$popular\` to get a list of the 10 most popular tracks
\`$add [#|all]\` to add a search result(s) to the playlist
\`$remove #\` to remove a track from the playlist
\`$skip\`  to go to the next song
\`$queue\` to see to current queue
\`$f12\` to skip to the next number`
const root = process.argv[2]

// variables to hold the playlist search results
let playlists = {}
let searchresults = {}
let connections = {}

client.on('ready', () => {
    console.log("bot started")
})

function play(guild_id){
    if(playlists[guild_id] == undefined || playlists[guild_id] == 0){
        console.log('playlist empty')
        return
    }

    // log playback
    console.log('start playback:' + trackToTitle(playlists[guild_id][0]))
    incPlayCounter(playlists[guild_id][0].ID)
    
    connections[guild_id].play(root + playlists[guild_id][0].Path).on("finish", () => 
        nextSong(guild_id)
    )
}

function incPlayCounter(id){
    fetch(`http://localhost:8080/incplaycounter?query=${id}`)
}

function nextSong(guild_id){
    playlists[guild_id].shift()
    play(guild_id)
}

function addTrack(tracks, message){
    if(tracks.length == 0){
        message.channel.send("No tracks added")
        return
    }
    m = `Added to playlist:\`\`\``
    for(let n of tracks){
        m += `${trackToTitle(n)}\n`
        playlists[message.guild.id].push(n)
    }
    m += '\`\`\`'
    message.channel.send(m)
}

function trackToTitle(data){
    if(data.Title.Valid && data.Artist.Valid)
        return `${data.Artist.String} - ${data.Title.String}`
    else
        return data.Path
}

function accessCheck(message){
    if (!message.member.voice.channel){
        message.channel.send("You must be in a voice channel.")
        return false
    }
    if (!message.guild.me.voice.channel){
        message.channel.send("I'm not in a voice channel yet :(\nuse `$join`")
        return false
    }
    if (message.guild.me.voice.channel.id != message.member.voice.channel.id){
        message.channel.send("You are not in the right voice channel")
        return false
    } 
    return true
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function cleanup(){
    for(let g of Object.keys(playlists)){
        client.guilds.fetch(g)
        .then(guild => {

            // if we are in a channel
            if(guild.me.voice.channel){
                if(guild.me.voice.channel.members.array().length == 1){

                    delete playlists[guild.id]

                    // this if statement should not ever _not_ fire
                    // but i'm scared to remove it
                    if(connections[g] != null) {
                        connections[g].disconnect()
                    }
                }
            }

        })
        .catch(err => console.log(`guild not found: ${err}`))
    }
}

// check for cleanup every 30 seconds
setInterval(cleanup, 30000)

client.on('message', message => {

    // not a command
    if (message.content.substring(0, 1) != '$') {
        return
    }

    // direct message
    if(!message.guild){
        message.channel.send(`If you are not in a server i don't care about your message. Im not here for personal smalltalk, loner.`)
        return
    }

    // log incoming commands
    console.log(`new command: ${message.content}`)

    var args = message.content.substring(1).split(' ')
    var cmd = args[0];
    args = args.splice(1)

    switch(cmd) {

        case 'help':
            message.channel.send(helpMessage)
        break;

        // search is dependent on the mmjs webserver
        case 's':
        case 'search':
            if (!accessCheck(message)) return            
            fetch(`http://localhost:8080/search?query=${encodeURI(args.join(" "))}`)
            .then(res => res.json())
            .then(data => {
                if(Object.entries(data).length == 0){
                    message.channel.send('No entries found :(')
                    return
                }
                searchresults[message.guild.id] = data
                let m = "Add to playlist by entering `$add <list of numbers>` or `$add all`: ```"
                for(let [k, v] of Object.entries(data)){
                    m += `${k}. ${trackToTitle(v)}\n`
                }
                m += '```'
                message.channel.send(m)
            })
            .catch(res => {
                message.channel.send(`Database not responding`)
            })
        break;
        
        case 'next':
        case 'f12':
        case 'skip':
            if (!accessCheck(message)) return            
            if(playlists[message.guild.id].length < 2){
                message.channel.send("No new track to skip to")
                return
            }
            message.channel.send("Skipping track")
            nextSong(message.guild.id)
        break;

        case 'r':
        case 'delete':
        case 'remove':
            if (!accessCheck(message)) return            
            
            if (playlists[message.guild.id].length === 0) 
                return message.channel.send("There's nothing in the playlist yet")
            
            let n = parseInt(args[0], 10)
            if (isNaN(n)) {
                return message.channel.send('Not a valid number')
            }

            if (n === 0){
                return message.channel.send(`Can't remove currently playing track`)
            }

            if(n > playlists[message.guild.id].length - 1 || n < 1){
                return message.channel.send(`This item is not in the queue`)
            }

            let r = playlists[message.guild.id][n]
            playlists[message.guild.id].splice(n, 1)

            message.channel.send(`Removed:\`\`\`${trackToTitle(r)}\`\`\``)

        break;

        case 'stop':
        case 'leave':
        case 'disconnect':
            if (!message.guild.me.voice.channel && connections[message.guild.id] == null) 
                return message.channel.send("I'm not in even in a voice channel ¯\\_(ツ)_/¯ ")
            
            delete playlists[message.guild.id]

            if(connections[message.guild.id] != null) {
                connections[message.guild.id].disconnect()
            }
            message.channel.send("Aight im boutta head out")
        break;

        case 'a':
        case 'add':
            if (!accessCheck(message)) return
            
            let empty = false
            if(playlists[message.guild.id].length === 0){
                empty = true
            } 

            // invalid command
            if (isNaN(parseInt(args[0], 10)) && args[0] != 'all') {
                message.channel.send('Not a valid number or command')
                return
            }

            // add everything
            if(args[0] == 'all') {
                addTrack(searchresults[message.guild.id], message)

                if(empty && playlists[message.guild.id].length > 0){
                    play(message.guild.id)
                }

                return
            }

            { // add numbers
                nums = []
                for(let a of args){
                    a = parseInt(a, 10)
                    if(isNaN(a)) continue
                    if (a < 0 || a > searchresults[message.guild.id].length - 1) continue
                    nums.push(searchresults[message.guild.id][a])
                }

                addTrack(nums, message)
                
                if(empty && playlists[message.guild.id].length > 0){
                    play(message.guild.id)
                }
            }
        break;

        case 'connect':
        case 'start':
        case 'join':
            if(!message.member.voice.channel) return message.channel.send("You must be in a voice channel.")
            if(message.guild.me.voice.channel) return message.channel.send("You are not in the right voice channel, stealing is bad you know")

            message.member.voice.channel.join().then(c => {

                // new server, initialize playlist
                if(!(message.guild.id in playlists)){
                    playlists[message.guild.id] = []
                }

                connections[message.guild.id] = c
                message.channel.send(helpMessage)
            }).catch(e => console.log(e))

        break;

        case 'random':
            if (!accessCheck(message)) return            
            fetch(`http://localhost:8080/random`)
            .then(res => res.json())
            .then(data => {
                if(Object.entries(data).length == 0){
                    message.channel.send('No entries found :(')
                    return
                }
                searchresults[message.guild.id] = data
                let m = "Add to playlist by entering `$add <list of numbers>` or `$add all`: ```"
                for(let [k, v] of Object.entries(data)){
                    m += `${k}. ${trackToTitle(v)}\n`
                }
                m += '```'
                message.channel.send(m)
            })
            .catch(res => {
                message.channel.send(`Database not responding`)
            })
        break;

        case 'q':
        case 'queue':
            if (!accessCheck(message)) return            
            if(playlists[message.guild.id].length === 0){
                message.channel.send('Queue is empty')
                return
            }
            
            { // dont let m leave the scope
                let m = "Queue: ```"
                for(let [k, v] of Object.entries(playlists[message.guild.id])){
                    if (k == 0) {
                        m += `${k}. (playing) ${trackToTitle(v)}\n`
                    } else {
                        m += `${k}. ${trackToTitle(v)}\n`
                    }
                }
                m += '```'
                message.channel.send(m)
            }
        break;

        case 'shuffle':
            if (!accessCheck(message)) return            
            if(playlists[message.guild.id].length === 0){
                message.channel.send('Queue is empty')
                return
            }
            
            {
                let current = playlists[message.guild.id].shift()
                shuffleArray(playlists[message.guild.id])
                playlists[message.guild.id].unshift(current)
                let m = "New playlist: ```"
                for(let [k, v] of Object.entries(playlists[message.guild.id])){
                    if (k == 0) {
                        m += `${k}. (playing) ${trackToTitle(v)}\n`
                    } else {
                        m += `${k}. ${trackToTitle(v)}\n`
                    }
                }
                m += '```'

                message.channel.send(m)
            }
        break;

        case 'populair':
        case 'popular':
            if (!accessCheck(message)) return            
            fetch(`http://localhost:8080/popular`)
            .then(res => res.json())
            .then(data => {
                if(Object.entries(data).length == 0){
                    message.channel.send('No entries found :(')
                    return
                }
                searchresults[message.guild.id] = data
                let m = "Add to playlist by entering `$add <list of numbers>` or `$add all`: ```"
                for(let [k, v] of Object.entries(data)){
                    m += `${k}. ${trackToTitle(v)} (${v.Plays} plays)\n`
                }
                m += '```'
                message.channel.send(m)
            })
            .catch(res => {
                message.channel.send(`Database not responding`)
            })
        break;

    }
})
