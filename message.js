var errorMsg = "Ha ocurrido un error. Por favor vuelva a intentarlo más tarde.";
var emptyPlatesMsg = "La placa debe contener por lo menos una letra o un número.";

function MessageHandler(context, event) {
    handlers.context = context;
    handlers.event = event;
    var userId = context.sender.id;
    var msgId = event.messageobj ? event.messageobj.refmsgid : '';
    if (msgId !== "") {
        context.saveMsgid(userId, msgId);
    } else {
        msgId = context.queryMsgid(userId, msgId);
    }
    var userName = event.senderobj.display.first_name;
    var msgData = {
        user: userName
    };
    if ((event.message.toLowerCase() === "menu")) {
        handlers.showMenu("first");
    } else if ((event.message.toLowerCase() === "volver al menú") || (event.message.toLowerCase() === "volver al menu")) {
        handlers.showMenu();
    } else if (event.message.toLowerCase() === "alta placa") {
        handlers.showBottonsAddplates();
    } else if (event.message.toLowerCase() === "baja placa") {
        context.platesQuery(userId, function (err, platesArray) {
            if (err) {
                console.log("Ha ocurrido un error. por favor vuelve a intentar mas tarde.");
            } else {
                if (platesArray.length === 0) {
                    context.sendResponse("Usted no se encuentra suscrito a ningunas placas.");
                } else {
                    context.sendResponse("Usted esta suscrito en la(s) siguientes placas, para seguir con el proceso de dar de baja una placa debe seleccionar una de la lista.");
                    var list = [{
                        "title": "Seleccioné una placa!",
                        "subtitle": "",
                        "imgurl": "",
                        "replies": platesArray
                    }];
                    handlers.showPlates(list, "deletePlates");
                }
            }
        });
        setTimeout(function(){
            handlers.listMsg("deletePlates");
        },850);
    } else if (event.message.toLowerCase() === "consultar placas") {
        context.platesQuery(userId, function (err, platesArray) {
            if (err) {
                console.log("Ha ocurrido un error. por favor vuelve a intentar mas tarde.");
            } else {
                if (platesArray.length === 0) {
                    context.sendResponse("Usted no se encuentra suscrito a ningunas placas.");
                    setTimeout(function () {
                        handlers.listMsg("queryPlatesNoExxists");
                    }, 450);
                } else {
                    var list = [{
                        "title": "Usted está suscrito a las siguientes placas:",
                        "subtitle": "",
                        "imgurl": "",
                        "replies": platesArray
                    }];
                    handlers.showPlates(list, "queryPlates");
                    setTimeout(function () {
                        handlers.listMsg("queryPlates");
                    }, 850);
                }
            }
        });
    } else if (event.message.toLowerCase() === "eliminar cuenta") {
        handlers.showBottonsDeletecount();
    } else if (msgId === "addPlates") {
        var text = event.message.toLowerCase();
        switch (text) {
        case "agregar placa":
            context.sendResponse("Ingrese el numero de placa?");
            break;
        default:
            var plates = extractPlates(text);
            if (plates.length > 0) {
                context.suscribeUser(userId, plates, function (err, type) {
                    if (err) {
                        //console.log("");
                    } else {
                        if (type === "already") {
                            context.sendResponse("Usted ya estaba suscrito a esas placas.");
                        } else {
                            assert(type === "ok");
                            context.sendResponse("Se ha suscrito exitosamente a las placas [" + plates + "].")
                                //context.saveUsers(userId, userName);
                            context.execiteCrawler(userId, function (option) {
                                setTimeout(function () {
                                    handlers.listMsg();
                                }, 850);
                            });
                        }
                    }
                });
            }
            break;
        }
    } else if (msgId === "deletePlates") {
        var plates = extractPlates(event.message);
        if (plates.length > 0) {
            context.unsuscribeUser(userId, plates, function (err, type) {
                if (err) {
                    msgData.text = errorMsg;
                } else {
                    if (type === "not-suscribed") {
                        msgData.text = "Usted no estaba suscrito a esas placas.";
                    } else {
                        assert(type === "ok");
                        msgData.text = "Usted ya no recibirá notificaciones de las placas [" + plates + "].";
                    }
                }
                context.sendResponse(msgData.text);
                setTimeout(function () {
                    handlers.listMsg();
                }, 550);
            });
        }
    } else if(msgId === "queryPlates"){
         
    }else if (msgId === "deletecount") {
        if (event.message.toLowerCase() === "si") {
            context.removeUser(userId, function (err, count) {
                if (err) {
                    msgData.text = errorMsg;
                } else {
                    if (count == 0) {
                        msgData.text = "Usted no tenía ninguna suscripción.";
                    } else {
                        msgData.text = "Se han borrado sus " + count + " suscripciones.";
                    }
                }
                context.sendResponse(msgData.text);
                setTimeout(function () {
                    handlers.listMsg();
                }, 450);
            });
        } else {
            handlers.listMsg();
        }
    } else {
        var backButton = "Volver al menú";
        message = {
            "type": "survey",
            "question": "Lo siento mucho, no entendí tu mensaje...",
            "options": [backButton]
        };
        context.sendResponse(JSON.stringify(message));
    }
}

var handlers = {
    listMsg: function (msgId) {
        var msgid = msgId ? msgId : "";
        var elements = [];
        if (msgid === "queryPlatesNoExxists") {
            elements.push({
                "content_type": "text",
                "title": "Alta placa ",
                "payload": "Alta placa"
            }, {
                "content_type": "text",
                "title": "Volver al menú",
                "payload": "Volver al menú"
            });
        }else if(msgid === "deletePlates"){
            elements.push({
                "content_type": "text",
                "title": "Volver al menú",
                "payload": "Volver al menú"
            });
        }else {
            elements.push({
                "content_type": "text",
                "title": "Volver al menú",
                "payload": "Volver al menú"
            });
        }
        var payload = {
            "type": "quick_reply",
            "payload": {
                "text": "¿Que deseas hacer?",
                "quick_replies": elements
            },
            "msgid": msgid
        };
        handlers.context.sendResponse(JSON.stringify(payload));
    },
    showMenu: function (isfirst) {
        var first = isfirst ? isfirst : ""
        if (first) {
            var userDetails = handlers.event.senderobj.display;
            handlers.context.sendResponse("¡Hola! " + userDetails.first_name + " " + userDetails.last_name + " \n¡Bienvenido a InfraccionesMX. Para recibir notificaciones sobre tus multas, debes darte de alta en el sistema. Este servicio es gratuito y todos los datos guardados serán usados exclusivamente para ofrecer este servicio y serán borrados si te das de baja. Al darte de alta, aceptas nuestros Términos y Condiciones. ¿Cómo puedo ayudarte?");
        } else {
            handlers.context.sendResponse("¿Cómo puedo ayudarte?");
        }
        var payload = {
            "type": "catalogue",
            msgid: "menu",
            "items": [
                {
                    "title": "Dar de alta una placa",
                    "subtitle": "Para seguir las multas de unas placas.",
                    "imgurl": "http://img.autocosmos.com/contenidos/galerias/1600x1200/GAZ_5c9630538b2942ffaaa5f8feb44e8090.jpg",
                    "replies": ["Alta placa"]
                },
                {
                    "title": "Dar de baja una placa",
                    "subtitle": "Para dejar de seguir las multas de unas placas.",
                    "imgurl": "http://dar-debaja.com/wp-content/uploads/2016/09/dar-de-baja-placas-df.png",
                    "replies": ["Baja placa"]
                },
                {
                    "title": "Consultar placas",
                    "subtitle": "Para consultar las placas a las que está suscrito.",
                    "imgurl": "http://www.dgii.gov.do/ciudadania/vehiculosMotor/consultas/Documents/VehMotor-01.png",
                    "replies": ["Consultar placas"]
                },
                {
                    "title": "Eliminar cuenta",
                    "subtitle": "Para darse de baja del servicio.",
                    "imgurl": "https://ignaciosantiago.com/wp-content/uploads/2015/04/eliminar-pagina-facebook.jpg",
                    "replies": ["Eliminar cuenta"]
                },
                {
                    "title": "Terminos y condiciones",
                    "subtitle": "Si quieres conocer los términos y condiciones y las políticas de privacidad de MultaBot,ingresa aquí.",
                    "imgurl": "http://www.jorgeleon.mx/wp-content/uploads/2016/10/condiciones.jpg",
                    "replies": [{
                        "title": "Ingresa aquí.",
                        "url": "https://data.finanzas.cdmx.gob.mx/sma/consulta_ciudadana.php"
                    }]
                }
            ]
        };
        setTimeout(function () {
            handlers.context.sendResponse(JSON.stringify(payload));
        }, 250);
    },
    addPLates: function(){
        var text = handlers.event.message;
        switch(text){
            case "":
                handlers.context.sendResponse("Ingrese el numero de placa");
                break;
            default:
                if(text.length > 0){
                    
                }
                break;
        }
    },
    showBottonsAddplates: function () {
        var payload = {
            "type": "quick_reply",
            "payload": {
                "text": "Al agregar un placa al sistema usted recibira notificaciones de las nuevas multas que se encuntré de la placa que usted agregó.\nPor favor de click en agregar placa!",
                "quick_replies": [
                    {
                        "content_type": "text",
                        "title": "Agregar placa",
                        "payload": "Agregar placa"
                    }
                ]
            },
            "msgid": "addPlates"
        };
        handlers.context.sendResponse(JSON.stringify(payload));
    },
    showPlates: function (plates, msgId) {
        var payload = {
            "type": "catalogue",
            "msgid": msgId,
            items: plates
        }
        handlers.context.sendResponse(JSON.stringify(payload));
    },
    showBottonsDeletecount: function () {
        var payload = {
            "type": "quick_reply",
            "payload": {
                "text": "Realmente desea cancelar la suscripción en el sistema de InfraccionesMX?",
                "quick_replies": [
                    {
                        "content_type": "text",
                        "title": "Si",
                        "payload": "Si"
                    },
                    {
                        "content_type": "text",
                        "title": "No",
                        "payload": "No"
                    }
                ]
            },
            "msgid": "deletecount"
        };
        handlers.context.sendResponse(JSON.stringify(payload));
    }
}

function extractPlates(plates) {
    var filteredPlates = "";
    var i = 0;
    var charCode = 0;
    // Ampersand mode skips over characters between an "&" and a ";"
    var ampersandMode = false;

    // Plates cannot be longer than 9 characters
    while (i < plates.length && filteredPlates.length < 9) {
        charCode = plates.charCodeAt(i);
        if (charCode == 38) {
            // Ampersand found
            ampersandMode = true;
        } else if (ampersandMode) {
            if (charCode == 59) {
                // Semicolon found
                ampersandMode = false;
            }
        } else if (isValidChar(charCode)) {
            filteredPlates += plates.charAt(i);
        }
        i++;
    }
    return filteredPlates.toUpperCase();
}

function isValidChar(charCode) {
    if (48 <= charCode && charCode <= 57) {
        // charCode is a number
        return true;
    } else if (65 <= charCode && charCode <= 90) {
        // charCode is upper-case letter
        return true;
    } else if (97 <= charCode && charCode <= 122) {
        // charCode is lower-case letter
        return true;
    } else {
        //return default
        return false;
    }
}
