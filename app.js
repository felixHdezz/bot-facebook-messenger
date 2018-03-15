const util = require('util');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const WatchJS = require("watchjs");
const moment = require('moment-timezone');
const sRequest = require('sync-request');
const MongoClient = require('mongodb').MongoClient;
const gdistance = require('gps-distance');
const app = express();
var debug = true;
var Sync = require('sync');
var assert = require('assert');
var PythonShell = require('python-shell');
var core = require("./core.js");
var watch = WatchJS.watch;

var vars = {
    config: {
        selectedToken: "proxy",
        tokens: {
            proxy: process.env.FB_PAGE_ACCESS_TOKEN_PROXY || "Token"
        }
    },
    sessions: {}
};
var welcomeMessage = "menu";
var selectedToken = "proxy";
var token = vars.config.tokens[vars.config.selectedToken];
const mongoUrl = 'Url MongoDB';
var lastMsgId = {};

try {
    var callerId = require('caller-id');
} catch (err) {
    debugPrint(null, 'caller-id was not present');
    callerId = null;
}

var dbGlob = null;
var dbPlates = null;
var dbNotifications = null;
var dblogs = null;
var dbMsgid = null;

function init() {
    MongoClient.connect(mongoUrl, function (err, db) {
        assert.equal(null, err);
        dbGlob = db;
        dbPlates = db.collection('plates');
        dbNotifications = db.collection('notifications');
        dblogs = db.collection('log');
        debugPrint(err, 'Connected to mongo');
    });
    app.set('port', (process.env.PORT || NUMBER));
    app.use(bodyParser.urlencoded({
        extended: false
    }));
    app.use(bodyParser.json());

    app.get('/', function (req, res) {
        res.send('Hello world, I am a chat bot')
    });

    app.get('/webhook/', webHookGet);

    app.post('/webhook/', webHookPost);

    app.listen(app.get('port'), function () {
        debugPrint(null,'running on port', app.get('port'));
    });
    setWelcomeMessage(welcomeMessage);
}

function setWelcomeMessage(welcomeMessage) {
    request({
        url: 'https://graph.facebook.com/v2.8/me/thread_settings',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: {
            "setting_type": "call_to_actions",
            "thread_state": "new_thread",
            "call_to_actions": [{
                "payload": welcomeMessage
                }]
        }
    }, function (error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        } else {
            debugPrint(null,'SERVER RESPONSE');
            //console.log(body);
        }
    });
}

function webHookGet(req, res) {
    if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
        res.send(req.query['hub.challenge'])
    } else {
        res.send('Error, wrong token')
    }
}

function webHookPost(req, res) {
    let messaging_events = req.body.entry[0].messaging;
    try {
        for (let i = 0; i < messaging_events.length; i++) {
            let event = req.body.entry[0].messaging[i];
            //console.log(event);
            if (event.message && event.message.attachments && event.message.is_echo) {

            } else if (event.message && event.message.is_echo) {
                handlerMessageEcho(event);
            } else if (event.delivery) {
               // handlerMessageDelivered(event);
            } else if (event.read) {
                //handlerMessageRead(event);
            } else {
                handlerMessageNew(event);
            }
        }
    } catch (e) {
    }
    res.sendStatus(200)
}

function Client(){
    var fs = require('fs');
    eval(fs.readFileSync('../client/code.js') + '');
    this.MessageHandler = MessageHandler;
}

function getSession(context, event, callback){
    var userId = context.recipient.id;
    try{
        vars.sessions[userId] = new Client();
    }catch(e){
        vars.sessions[userId] = null;
        console.log(e);
    }
    callback(vars.sessions[userId]);
}

function initUserObject(event, callback){
    var context = new Context(event);
    var evento =  new Event(event)
    var userId = event.recipient.id;
    getSession(context, evento, function (session) {
        callback(context, evento, session);
    });
}

function handlerMessageNew(event){
    initUserObject(event, function(context, event, session){
        try{
            session.MessageHandler(context, event);
        }catch(e){
            console.log("Error : "+e);
        }
    });
}

function Context(event){
    this.sender = event.sender;
    this.recipient = event.recipient;
    this.console = console;
    var context = this;
    this.sendResponse = sendResponse;
    this.suscribeUser = suscribe;
    this.unsuscribeUser = unsuscribe;
    this.removeUser = remove;
    this.platesQuery = query;
    this.execiteCrawler = executePythonCrawler;
    this.saveMsgid = saveMsgId;
    this.queryMsgid = queryMsgId;
    this.queryPlates = queryPlate;
    this.userSuscribe = suscribeUser;
    this.userUnsuscribe = unsuscibreUser;
}

function Event(event){
    var resp = true;
    this.type = '';
    this.attachments = null;
    var userId = event.sender.id;
    this.message = '';
    this.incoming = false;
    if (event.hasOwnProperty("message") && !event.hasOwnProperty("postback") && !event.hasOwnProperty("is_echo") && !event.message.hasOwnProperty("is_echo")) {
        this.incoming = true;
        debugPrint(null,"recibiendo algo");
    }
    //mensajes entrantes
    if ((this.incoming == true) && (event.message.hasOwnProperty("attachments"))) {
        console.log("Prueba de datos : " +event);
        //    console.log(event.is_echo);
        var content = JSON.stringify(event.message.attachments);
        //console.log(lenx);
        content = content.slice(1, (content.length) - 1);
        try {
            content = JSON.parse(content);
            this.type = content.type;
            if (content.type != 'location') {
                if (content.type == 'image') {
                    if ((content.payload.url.indexOf(".gif?") == -1) && (content.payload.url.indexOf("/t39.1997-6/p100x100") == -1)) {
                        //console.log(content.payload.url);
                    } else {
                        resp = false;
                        //console.log('es un sticker o un gif');
                    }
                }
            } else {
                // console.log(content.payload.coordinates);
            }
        } catch (e) {
            this.type = 'multiple_files'
        }
        if (resp) {
            console.log("type:" + this.type);
            if (this.type != 'multiple_files') {

                if (this.type !== "fallback") {
                    this.attachments = content.payload.url;
                    if (this.type == 'location') {
                        console.log(content.payload.coordinates);
                        this.attachments = content.payload.coordinates;
                    }
                }
            } else {
                //console.log("[" + content + "]");
                this.attachments = ("[" + content + "]");
            }
        }

    } else {
        this.type = ('text');
    }
    if (event.message && event.message.text) {
        this.message = event.message.text;
    }
    if (event.postback) {
        this.postback = event.postback;
        if (event.postback.payload) {
            this.message = event.postback.payload;
        } else {
            this.message = JSON.stringify(event.postback);
        }
    }
    this.getresp = event.getresp ? event.getresp : null;
    this.geturl = event.geturl ? event.geturl : null;
    if (lastMsgId[userId]) {
        this.messageobj = {
            refmsgid: lastMsgId[userId]
        };
    }
    this.sender = userId;
    try {
        this.senderobj = {
            display: getJSON("https://graph.facebook.com/v2.8/" + this.sender + "?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=" + token)
        };
    } catch (e) {
        debugPrint(e,null);
    }
    this.recipient = event.recipient.id;
    this.dbval = '';
}

function getJSON(url) {
    var res = sRequest('GET', url);
    return JSON.parse(res.getBody());
}

function sendResponse(msg,UserId){
    var message = msg;
    var userId = "";
    if(this.sender){
        userId = this.sender.id;
    }else{
        userId = UserId;
    }
    lastMsgId[userId] = null;
    if (message.startsWith('{') || message.startsWith('[')) {
        message = JSON.parse(msg);
        sendPayload(userId, message);
    } else {
        prepareMessageText(userId, message);
    }
}

function prepareSendMessageGeneric(userid, message) {
    var exit = {
        "template_type": "generic",
        "elements": []
    }
    for (var i in message.items) {
        var item = message.items[i];
        var index = exit.elements.push({
            "title": item.title,
            "image_url": item.imgurl,
            "subtitle": item.subtitle,
            "buttons": []
        });
        if (item.replies) {
            for (var j in item.replies) {
                var reply = item.replies[j];


                if (reply.payload) {

                    exit.elements[index - 1].buttons.push({
                        "type": "postback",
                        "title": reply.title,
                        "payload": reply.payload
                    });

                } else if (reply.phone) {

                    exit.elements[index - 1].buttons.push({
                        "type": "phone_number",
                        "title": reply.title,
                        "payload": reply.phone
                    });

                } else if (reply.url) {

                    exit.elements[index - 1].buttons.push({
                        "type": "web_url",
                        "title": reply.title,
                        "url": reply.url
                    });

                } else {
                    exit.elements[index - 1].buttons.push({
                        "type": "postback",
                        "title": reply,
                        "payload": reply
                    });

                }
            }
        } else {
            for (var j in message.replies) {
                var reply = message.replies[j];
                exit.elements[index - 1].buttons.push({
                    "type": "postback",
                    "title": reply,
                    "payload": reply + ' ' + index
                });
            }
        }
    }
    sendMessageTemplate(userid, exit);
}

function sendTyping(userid) {
    request({
        url: 'https://graph.facebook.com/v2.8/me/messages',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: {
            "recipient": {
                "id": userid
            },
            "sender_action": "typing_on"
        }
    }, function (error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        } else {
        }
    })
}

function sendMedia(userid, fileUrl, mediaType) {
    request({
        url: 'https://graph.facebook.com/v2.8/me/messages',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: {
            "recipient": {
                "id": userid
            },
            "message": {
                "attachment": {
                    "type": mediaType,
                    "payload": {
                        "url": fileUrl
                    }
                }
            }
        }
    }, function (error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        } else {
        }
    });
    console.log('SERVER RESPONSE');
}

function prepareSendMessageButton(userid, message) {
    var exit = {
        "template_type": "button",
        "text": message.question,
        "buttons": []
    }
    for (var i in message.options) {
        var option = message.options[i];
        exit.buttons.push({
            "type": "postback",
            "title": option,
            "payload": option
        });
    }
    sendMessageTemplate(userid, exit);
}

function sendMessageTemplate(userid, message) {
    request({
        url: 'https://graph.facebook.com/v2.8/me/messages',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: {
            "recipient": {
                "id": userid
            },
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": message
                }
            }
        }
    }, function (error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        } else {
        }
    })
}

function prepareSendMessageQuick(userid, message) {
    //  console.log(message);
    sendMessageAll(userid, message);
}

function prepareMessageText(userid, message) {
    var exit = {
        text: message
    }
    sendMessageAll(userid, exit);
}

function sendPayload(userid, message) {
    if (message.attachment) {
        sendDirect(message);
    } else if (message.type) {
        if (message.msgid) {
            lastMsgId[userid] = message.msgid;
        }
        switch (message.type) {
            case "quick_reply":
                prepareSendMessageQuick(userid, message.payload);
                break;
            case "catalogue":
                prepareSendMessageGeneric(userid, message);
                break;
            case "receipt":
                sendMessageTemplate(userid, message.payload);
                break;
            case "survey":
                prepareSendMessageButton(userid, message);
                break;
            case "file":
                sendMedia(userid, message.url, message.type);
                break;
            case "typing":
                sendTyping(userid);
                break;
            default:
                prepareMessageText(userid, JSON.stringify(message));
                break;
        }
    } else {
        prepareMessageText(userid, JSON.stringify(message));
    }
}

function sendMessageAll(userid, message) {
    request({
        url: 'https://graph.facebook.com/v2.8/me/messages',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: {
            "recipient": {
                "id": userid
            },
            "message": message
        }
    }, function (error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        } else {
            debugPrint(null,"sent messages");
        }
    })
}

//Base de datos

function suscribeUser(user, plates, callback){
    core.suscribeUser(true, user, plates, function(err,type){
        if(err){
            debugPrint(err, null);
        }else{
            if(type === 'ok'){
                debugPrint(null, "insert user...");
                callback('ok');
            }
        }
    });
}

function unsuscibreUser(user, plates, callback){
    core.UnsuscribeUser(true, user, plates, function(err, type){
        if(err){
            debugPrint(err, null);
        }else{
            if(type === 'ok'){
                debugPrint(null,'remove user');
                callback(type);
            }
        }
    });
}

function removeUser(user, callback){
    core.removeUser(true, user, function(err, count){
        if(err){
            debugPrint(err, null);
        }else{
            callback(count);
        }
    });
}

function unsuscribe(user, plates, callback) {
    var cursor = dbPlates.find({_id: plates,usersFB: user});
    cursor.count(function (err, count) {
        if (err) {
            debugPrint("unsuscribe.count: " + err, null);
            callback(err, 'error');
        } else if (count == 0) {
            callback(null, 'not-suscribed');
        } else {
            // _id queries should return at most 1 result
            assert.equal(1, count);

            var confirmOperation = function (err, ack) {
                if (err) {
                    debugPrint("unsuscribe.[update|remove]: " + err, null);
                    callback(err, 'error');
                } else {
                    assert.equal(1, ack.result.n);
                    callback(null, 'ok');
                }
            }
            // Get first (and only) document in cursor
            cursor.next(function (err, platesDoc) {
                if (err) {
                    debugPrint("unsuscribe.next: " + err, null);
                    callback(err, 'error');
                } else {
                    var index = platesDoc.usersFB.indexOf(user);
                    // The user should always be contained in the array because of query
                    assert(index > -1);
                    // Remove user at index
                    var removed = platesDoc.usersFB.splice(index, 1);
                    debugPrint(null, 'Removing ' + removed[0] + ' from ' + platesDoc._id);
                    if (platesDoc.usersFB.length > 0) {
                        dbPlates.update({
                            _id: platesDoc._id
                        }, {
                            $set: {
                                usersFB: platesDoc.usersFB
                            }
                        }, confirmOperation);
                    } else {
                        // Delete plates if there are no users left
                        if(platesDoc.users.length === 0 && platesDoc.usersFB.length === 0){
                            dbPlates.remove({
                                _id: platesDoc._id
                            }, confirmOperation);
                        }
                    }
                }
            });
        }
    });
}

function remove(user, callback) {
    var delCount = 0;
    var failCount = 0;
    var cursor = dbPlates.find({usersFB: user});
    cursor.count(function (err, count) {
        if (err) {
            // delCount is always 0 at this point
            debugPrint('remove.count: ' + err, null);
            callback(err, delCount);
        } else if (count == 0) {
            callback(null, delCount);
        } else {
            var increaseCounter = function (err, ack) {
                if (err) {
                    debugPrint('remove.[update|remove]: delCount=' + delCount + ', err=' + err, null);
                    callback(err, delCount);
                } else {
                    if (ack.result.n == 1) {
                        // Sucessful update/remove
                        delCount++;
                    } else {
                        debugPrint("Could not update/remove", null);
                        failCount++;
                    }
                    if (count == delCount + failCount) {
                        callback(failCount, delCount);
                    }
                }
            }
            cursor.forEach(function (platesDoc) {
                var index = platesDoc.usersFB.indexOf(user);
                // The user should always be contained in the array because of query
                assert(index > -1);
                // Remove user at index
                var removed = platesDoc.usersFB.splice(index, 1);
                debugPrint(null, 'Removing ' + removed[0] + ' from ' + platesDoc._id);
                if (platesDoc.usersFB.length > 0) {
                    dbPlates.update({
                        _id: platesDoc._id
                    }, {
                        $set: {
                            usersFB: platesDoc.usersFB
                        }
                    }, increaseCounter);
                } else {
                    // Delete plates if there are no users left
                    if(platesDoc.users.length === 0 && platesDoc.usersFB.length === 0){
                        dbPlates.remove({
                            _id: platesDoc._id
                        }, increaseCounter);
                    }
                }
            });
        }
    });
}

function query(user, callback) {
    var platesArray = [];
    var cont = 0;
    var cursor = dbPlates.find({usersFB: user}, {_id: 1});
    cursor.count(function (err, count) {
        if (err) {
            debugPrint("query.count: " + err, null);
            callback(err, null);
        } else {
            if (count == 0) {
                callback(null, platesArray);
            } else {
                cursor.toArray(function (err, docs) {
                    if (err) {
                        debugPrint("query.toArray: " + err, null);
                        callback(err, null);
                    } else {
                        for (var i = 0; i < docs.length; i++) {
                            platesArray.push(docs[i]._id);
                        }
                        callback(null, platesArray);
                    }
                });
            }
        }
    });
}

function queryPlate(user,plates, callback){
    dbNotifications.insertOne({'plates': plates,'newUser': user,'isUpdated': false},function(err, resp){
        if(err){
            debugPrint(err, null);
        }else{
            debugPrint(null,"insert newPlates");
            callback('ok');
        }
    });
}

function saveMsgId(userId, msgId){
    var logmsgid = dbGlob.collection('fb').find({'userId':userId});
    logmsgid.count(function(err, count){
        if(err){
            debugPrint(err, null);
        }else{
            if(count === 0){
                dbGlob.collection('fb').insert({'userId':userId,'msgid':msgId});
            }else{
                dbGlob.collection('fb').update({'userId':userId},{$set:{'msgid':msgId}});
            }
        }
    });
}

function queryMsgId(userId, msgId){
    var dbMgsId = dbGlob.collection('fb').findOne({'userId':userId},function(er,MsgId){
        if(MsgId){
            //console.log("database msgid : "+MsgId.msgid);
            dbMsgid = MsgId.msgid;
        }
    });
    //console.log("val : " +dbMsgid);
    return ""+dbMsgid;
}

//Ejecucion del crawler para la extraccion de datos de la placa
function executePythonCrawler(userId, callback) {
    try {
        var options = {
            mode: 'text',
            pythonOptions: ['-u'],
            scriptPath: 'DIRPATH',
            args: []
        };
        PythonShell.run('on-demand.py',options, function (err, res) {
            if (err) {
                console.log(err);
            } else {
                debugPrint(null,"la ejecucion del archivo python fue satisfactorio");
                notificacion(userId);
                callback("ok");
            }
        });
    } catch (e) {
        console.log("Error : "+e);
    }
}

function notificacion(userId){
    getNewUserToNotification(function (err, dbNewUsers) {
        if (err) {
            console.log(err);
        } else {
            var arrayUsers = dbNewUsers;
            if (arrayUsers.length > 0) {
                for (var i = 0; i < arrayUsers.length; i++) {
                    getTicket(arrayUsers[i], function (err, dbTickets, dbUsers) {
                        var msgData = {user:dbUsers.user};
                        if(err){
                            console.log(err);
                        }else{
                            if(dbTickets.length === 0){
                                msgData.text = "Sin adeudos! no se encontrarón multas de la placa  ó la placa no existe.";
                            }else{
                                var contisPaid = 0, contnoPaid = 0;
                                for(var i = 0; i < dbTickets.length; i++){
                                    if(dbTickets[i].isPaid === true){
                                        contisPaid++;
                                    }else if(dbTickets[i].isPaid === false){
                                        contnoPaid++;
                                    }
                                }
                                msgData.text = "En este momento, tienes ";
                                if(contisPaid === 0 && contnoPaid === 0){
                                    msgData.text += "0 multas";
                                }else if(contisPaid === 1 && contnoPaid === 0){
                                    msgData.text += contisPaid+" multa pagada y "+contnoPaid+" multas si pagar.";
                                }else if(contisPaid > 1 && contnoPaid === 0){
                                    msgData.text += contisPaid+" multas pagadas y "+contnoPaid+" multas sin pagar.";
                                }else if(contisPaid === 1 && contnoPaid === 1){
                                    msgData.text += contisPaid+" multa pagada y "+contnoPaid+" multa sin pagar.";
                                }else if(contisPaid > 1 && contnoPaid === 1){
                                    msgData.text += contisPaid+" multas pagadas y "+contnoPaid+" multa sin pagar.";
                                }else if(contisPaid === 1 && contnoPaid > 1){
                                    msgData.text += contisPaid+" multa pagada y "+contnoPaid+" multas sin pagar.";
                                } else if(contisPaid > 1 && contnoPaid > 1){
                                    msgData.text += contisPaid+" multas pagadas y "+contnoPaid+" multas sin pagar.";
                                }
                            }
                            dbGlob.collection('notifications').remove({plates: dbUsers.plates,newUser: msgData.user});
                            sendResponse(msgData.text, userId);
                            updateUsersExcept(dbUsers.plates,dbUsers.user);
                        }
                    });
                }
            } else {
                debugPrint(null, 'No hay registros de nuevos usuarios');
            }
        }
    });
}

function updateUsersExcept(plates,user){
    dbExistsTicket = dbGlob.collection('notifications').find({'plates':plates,'$or':[{'paidTicket':{'$exists':true}},{'newTicket':{'$exists':true}}]});
    
    dbExistsTicket.count(function(err,count){
        if(err){
            debugPrint(err,null);
        }else{
            if(count === 0){
                debugPrint(null,"No hay paidTicket ni newTicket para las placas " + plates +".")
            }else{
                dbExistsTicket.forEach(function(doc){
                    index = doc.except.indexOf(user);
                    if(index > -1){
                        //debugPrint(null,"no hay nuevo usuario");
                    }else{
                        doc.except.push(user);
                        dbGlob.collection('notifications').update({'_id':doc._id},{$set:{'except':doc.except}});
                    }
                });
            }
        }
    })
}

function getNewUserToNotification(callback) {
    var arrayUsers = [];
    var dbNewUsers = dbGlob.collection('notifications').find({newUser: {$exists: true}});
    dbNewUsers.count(function (err, count) {
        if (err) {
            console.log(err);
            callback(err, null);
        } else {
            if (count > 0) {
                dbNewUsers.toArray(function (err, list) {
                    if (err) {
                        console.log(err);
                        callback(err, null);
                    } else {
                        for (var i = 0; i < list.length; i++) {
                            arrayUsers.push({
                                plates: list[i].plates,
                                user: list[i].newUser
                            });
                        }
                        callback(null, arrayUsers);
                    }
                });
            } else {
                callback(null, arrayUsers);
            }
        }
    });
}

function getTicket(dbUsers, callback) {
    var arrayTickets = [];
    var dbPlates = dbGlob.collection('plates').find({_id: dbUsers.plates});
    dbPlates.count(function (err, count) {
        if (err) {
            console.log(err);
        } else {
            if (count > 0) {
                dbPlates.toArray(function (err, tickets) {
                    if (err) {
                        console.log(err);
                    } else {
                        for (var i = 0; i < tickets.length; i++) {
                            arrayTickets = tickets[i].tickets;
                        }
                        callback(null, arrayTickets, dbUsers);
                    }
                });
            } else {
                callback(null, arrayTickets,dbUsers);
            }
        }
    });
}

function debugPrint(err, message) {
    if (debug) {
        var msg = getTime();
        if (callerId) {
            if (callerId.getString()) {
                msg += callerId.getString() + ': ';
            } else {
                msg += 'anonymousFunction: ';
            }
        }
        if (err) {
            msg += 'Error occurred. ' + err;
        } else {
            msg += message
        }
        console.log(msg);
    }
}

function getTime() {
    var now = new Date();
    return '[' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds() + '] ';
}

function cleanUp() {
    debugPrint(null, 'Logging out');
    dbGlob.logout(function (err, result) {
        assert.equal(true, result);
        debugPrint(err, 'Logged out');
        dbGlob.close(function (err, result) {
            debugPrint(err, "Closed");
        });
    });
}

process.on('SIGINT', cleanUp);
process.on('SIGTERM', cleanUp);

init();
