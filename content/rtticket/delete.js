// Copyright 2006, 2014 The University of British Columbia and Derek Poon
// Released under the Mozilla Public License, v2.0.

/*********************************************************************
 * Initialization
 ********************************************************************/

RTTicket.deleteJunk = {};

RTTicket.deleteJunk.setup = function setup(windowLoadEvent) {
    if (typeof DefaultController != 'undefined') {
        // Setup for 3-pane window
        RTTicket.deleteJunk.setup3PaneWindow(windowLoadEvent);
    } else if (typeof MsgDeleteMessageFromMessageWindow != 'undefined') {
        // Setup for message window
        RTTicket.deleteJunk.setupMessageWindow(windowLoadEvent);
    } else {
        RTTicket.log.error('No place to add cmd_delete hook');
    }
};

/**
 * Add hook for cmd_delete in the 3-pane window's DefaultController
 * (defined in chrome://messenger/content/mail3PaneWindowCommands.js)
 */
RTTicket.deleteJunk.setup3PaneWindow = function setup3PaneWindow(windowLoadEvent) {
    var oldDoCommand = DefaultController.doCommand;
    DefaultController.doCommand = function doCommand(command) {
        if (!this.isCommandEnabled(command)) return;

        switch (command) {
          case 'button_delete':
          case 'cmd_delete':
          case 'cmd_shiftDelete':
            /*
            if (! RTTicket.deleteJunk.ensurePassword(false)) {
                break;
            }
            */
            RTTicket.deleteJunk.deleteTicketIfJunk(false);
            // RTTicket.log.debug('Disabled real delete'); return;
            break;
          case 'cmd_deleteJunk':
            /*
            if (! RTTicket.deleteJunk.ensurePassword(false)) {
                break;
            }
            */
            RTTicket.deleteJunk.deleteTicketIfJunk(true);
            // RTTicket.log.debug('Disabled real delete'); return;
            break;
        }
        oldDoCommand(command);
    };
    RTTicket.log.debug('Added hook for cmd_delete in 3-pane window');
};


/**
 * Add hook for cmd_delete in the message window
 * (defined in chrome://messenger/content/messageWindow.js)
 */
RTTicket.deleteJunk.setupMessageWindow = function setupMessageWindow(windowLoadEvent) {
    var oldMsgDeleteMessage = MsgDeleteMessageFromMessageWindow;
    MsgDeleteMessageFromMessageWindow = function(reallyDelete, fromToolbar) {
        //if (RTTicket.deleteJunk.ensurePassword(false)) {
            RTTicket.deleteJunk.deleteTicketIfJunk(false);
        //}
        // RTTicket.log.debug('Disabled real delete'); return;
        oldMsgDeleteMessage(reallyDelete, fromToolbar);
    };
    RTTicket.log.debug('Added hook for cmd_delete in message window');
};

RTTicket.deleteJunk.teardown = function teardown(windowUnloadEvent) {
    // TODO: Cleanly remove hook
};


/*********************************************************************
 * Commands
 ********************************************************************/

RTTicket.deleteJunk.deleteTicketIfJunk = function deleteTicketIfJunk(wholeFolder) {
    // For each selected message that is marked as junk mail, the following
    // function is called for each RT-Ticket header in the message.
    // It makes a POST to the webserver using RT's REST interface to
    // delete the ticket.
    function deleteJunkTicketForHdr(msgHdr) {
        return function deleteJunkTicket(hdrName, rtticketHeaderValue, instanceCount) {
            if (instanceCount > 1) {
                RTTicket.log.error('Second RT-Ticket header encountered: '
                                   + rtticketHeaderValue);
                return;
            }
            var match = /(.*)\s+#(\d+)$/.exec(rtticketHeaderValue);
            if (!match) {
                RTTicket.log.error('Malformed RT-Ticket header: '
                                   + rtticketHeaderValue);
                return;
            } else if (match[1] != RTTicket.prefs.rtDomain) {
                RTTicket.log.debug('Not deleting ticket ' + match[2] + ' in ' +
                                   match[1] + ' domain');
                return;
            }

            var ticketNumber = match[2];
            RTTicket.log.debug('Deleting junk ticket ' + ticketNumber);

            var current = RTTicket.getIdentityAndAccount(msgHdr);
            var mailfrom = current.identity.email;
            var varBindings = {
                ticket: ticketNumber,
                mailfrom: mailfrom,
                mailfromdomain: mailfrom.substr(1 + mailfrom.lastIndexOf('@')),
                rtdomain: RTTicket.prefs.rtDomain
            };

            var rtServer = RTTicket.interpolateVars(RTTicket.prefs.rtWeb,
                                                    varBindings);
            var postUrl = rtServer + '/REST/1.0/ticket/' + ticketNumber + '/comment';
            var restContent = {
                Status: 'deleted'
            };
            var postArgs = {
                user: RTTicket.interpolateVars(RTTicket.prefs.rtUser,
                                               varBindings),
                pass: RTTicket.deleteJunk.password,
                content: ''
            };

            // The POST body is handled by RT::Interface::REST::form_parse()
            // The resulting POST body should look like
            // user=(username)&pass=(password)&content=Status:%20deleted
            var prop;
            for (prop in restContent) {
                postArgs.content += prop + ': ' +
                                    restContent[prop].replace(/\n/,'\n ')+'\n';
            }

            function makePostBody(postArgs) {
                var postBody = '';
                for (prop in postArgs) {
                    postBody += '&' + encodeURI(prop) +
                                '=' + encodeURI(postArgs[prop]);
                }
                // postBody contains the password, so the following line should
                // normally be disabled!
                // RTTicket.log.debug(postBody.substring(1));
                return postBody.substring(1);               // Discard initial '&'
            }
            var postBody = makePostBody(postArgs);

            function doDelete(postUrl, postBody) {
                var req = new XMLHttpRequest();
                req.onreadystatechange = function() {
                    // TODO: Better status displays than alert()
                    if (req.readyState == 4) {          // Complete
                        try {
                            var status = req.status;
                            if (status != 200) {
                                var errMsg = 'Error ' + req.status + ' (' +
                                             req.statusText +
                                             ') while deleting ticket ' +
                                             ticketNumber;
                                RTTicket.log.error(errMsg);
                                alert(errMsg);
                                return;
                            }
                        } catch (e) {
                            // No status at all -- connection failure
                            RTTicket.log.error(e);
                            alert('Failed to connect to Request Tracker ' +
                                  'server at\n' + rtServer + '.\nTicket ' +
                                  ticketNumber + ' was not deleted.');
                            return;
                        }

                        if (/That is already the current value/.test(req.responseText)){
                            RTTicket.log.debug('Ticket ' + ticketNumber +
                                               ' was already deleted');
                        } else if (/Ticket deleted/.test(req.responseText) ||
                                   new RegExp('Ticket ' + ticketNumber + ' updated').test(req.responseText)) {
                            RTTicket.log.debug('Successfully deleted ticket ' +
                                               ticketNumber);
                        } else if (/Credentials required/.test(req.responseText)) {
                            RTTicket.log.debug(req.responseText);
                            // Prompt for password and try again
                            if ((postArgs.pass = RTTicket.deleteJunk.ensurePassword(true))) {
                                doDelete(postUrl, makePostBody(postArgs));
                            }
                        } else {
                            RTTicket.log.error(req.responseText);
                            alert(req.responseText);
                        }
                    }
                };

                req.open('POST', postUrl, /* async= */ true);
                req.setRequestHeader('Content-Type',
                                     'application/x-www-form-urlencoded');
                req.send(postBody);
            }
            doDelete(postUrl, postBody);
        };
    }

    var messenger = Components.classes['@mozilla.org/messenger;1']
                              .createInstance(Components.interfaces.nsIMessenger);
    var indices = [];
    if (wholeFolder) {
        var treeView = gDBView.QueryInterface(Components.interfaces.nsITreeView);
        var count = treeView.rowCount;
        for (var c = 0; c < count; c++) {
            indices.push(c);
        }
    } else {
        var dummy = {};
        gDBView.getIndicesForSelection(dummy, {});
        indices = dummy.value;
    }

    for (var i in indices) {
        var msgUri = gDBView.getURIForViewIndex(indices[i]);
        // nsIMessenger.msgHdrFromURI() requires Thunderbird 1.5?
        // var msgHdr = messenger.msgHdrFromURI(msgUri);
        var msgSvc = messenger.messageServiceFromURI(msgUri);
        var msgHdr = msgSvc.messageURIToMsgHdr(msgUri);

        var junkScore = msgHdr.getStringProperty('junkscore');
        var isJunk = (junkScore != '') && (junkScore != '0');
        if (isJunk) {
            RTTicket.actOnHeader(msgUri,
                                 /RT-Ticket/i,
                                 deleteJunkTicketForHdr(msgHdr));
        }
    }
};


/*********************************************************************
 * Helpers
 ********************************************************************/

RTTicket.deleteJunk.ensurePassword = function ensurePassword(change) {
    var server = gDBView.msgFolder.server;
    if (!server.type) {
        // accountManager in chrome://messenger/content/AccountManager.js
        server = accountManager.localFoldersServer;
    }
    var mailPassword = server.password;

    if (!change && mailPassword != null && mailPassword.length) {
        RTTicket.deleteJunk.rtPassword = mailPassword;
        return RTTicket.deleteJunk.rtPassword;
    } else {
        var promptSvc = Components.classes['@mozilla.org/embedcomp/prompt-service;1']
                                  .getService(Components.interfaces.nsIPromptService);
        var password = { value: '' };
        var savePassword = { value: true };
        if (promptSvc.promptPassword(window,
                'Request Tracker Password',
                'Password for Request Tracker Domain ' +
                  RTTicket.prefs.rtDomain + ':',
                password,
                'Remember password for this session',
                savePassword)) {
            if (savePassword.value) {
                RTTicket.deleteJunk.rtPassword = password.value;
            }
            return password.value;
        } else {
            return null;
        }
    }
};

/* vim: set shiftwidth=4 expandtab: */
