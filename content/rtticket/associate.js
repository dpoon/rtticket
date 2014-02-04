/*********************************************************************
 * Copyright 2006, 2014 The University of British Columbia and Derek Poon
 * Released under the Mozilla Public License, v2.0.
 *
 * associate.js  procedures to associate an e-mail with a ticket
 *
 * Based on mailredirect-compose.js of Pawel Krzesniak's mailredirect
 * extension, which is in turn based on mail.jar!/MsgComposeCommands.js.
 ********************************************************************/

/*********************************************************************
 * Initialization
 ********************************************************************/

RTTicket = window.arguments[0];

RTTicket.associate.args = {
    selectedURIs: window.arguments[1],
    id: window.arguments[2],
    account: window.arguments[3]
};

RTTicket.associate.controller = {
    supportsCommand: function(command) {
        switch (command) {
          case 'cmd_rtticket_associate_associate':
          case 'cmd_rtticket_associate_close':
            return true;
          default:
            return false;
        }
    },

    isCommandEnabled: function(command) {
        // RTTicket.log.debug('isCommandEnabled: ' + command);
        switch (command) {
          case 'cmd_rtticket_associate_associate':
            var ticketInput = document.getElementById('ticketnumber-input');
            return RTTicket.associate.prefs.resendTo.length &&
                   ticketInput.value && ticketInput.value.length != 0;
          case 'cmd_rtticket_associate_close':
            return true;
          default:
            return false;
        }
    },

    doCommand: function(command) {
        // RTTicket.log.debug('doCommand: ' + command);
        if (!this.isCommandEnabled(command)) { return; }
        switch (command) {
          case 'cmd_rtticket_associate_associate':
            RTTicket.associate.associate();
            break;
          case 'cmd_rtticket_associate_close':
            RTTicket.associate.close();
            break;
        }
    },

    onEvent: function(event) {
        // RTTicket.log.debug('onEvent(' + event.type + ')');

        // See also RTTicket.compose.ticketKeyHandler
        var ticketInput = document.getElementById('ticketnumber-input');
        switch (event.type) {
          case 'keypress':
            if (event.target == ticketInput) {
                // Allow digits only.  Make some exceptions to allow pasting
                // (Shift-Insert, Cmd-V, Ctrl-V).
                var keyChar = String.fromCharCode(event.charCode);
                return /\d/.test(keyChar)       // Allow digits
                       || event.charCode == 0   // or non-printable, e.g. Ins
                       || event.metaKey         // or Cmd key on Mac
                       || event.ctrlKey;        // or Ctrl key
            }
            break;
          case 'keyup':
          case 'mouseup':
            if (event.target == ticketInput) {
                // Enable/disable the OK button depending on whether there is
                // text in the ticket number input field.  Filter again in case
                // non-digits got there by pasting.  (We handle mouseup because
                // it's possible to paste with the middle mouse button in X11.)
                ticketInput.value = ticketInput.value.replace(/\D/g, '');
                goUpdateCommand('cmd_rtticket_associate_associate');

                if (event.keyCode == 13) {      // VK_ENTER
                    goDoCommand('cmd_rtticket_associate_associate');
                }
            }
            break;
        }
        return true;
    }
};

RTTicket.associate.setup = function setup(windowLoadEvent) {
    // Install controller
    top.controllers.appendController(RTTicket.associate.controller);

    var msgWindow = Components.classes['@mozilla.org/messenger/msgwindow;1']
                              .createInstance(Components.interfaces.nsIMsgWindow);
    msgWindow.SetDOMWindow(window);
    RTTicket.associate.msgWindow = msgWindow;

    // Install listeners
    RTTicket.associate.prefs = new RTPrefsManager('extensions.rtticket.associate.');
    RTTicket.associate.prefs.register('resendTo', function(prefBranch, prefName) {
        RTTicket.associate.prefs.resendTo = prefBranch.getCharPref(prefName);
    });
    RTTicket.associate.prefs.register('overwriteOriginal', function(prefBranch, prefName) {
        RTTicket.associate.prefs.overwriteOriginal = prefBranch.getBoolPref(prefName);
    });
    RTTicket.associate.prefs.register('saveToSentMail', function(prefBranch, prefName) {
        RTTicket.associate.prefs.saveToSentMail = prefBranch.getBoolPref(prefName);
    });

    goUpdateCommand('cmd_rtticket_associate_associate');
    var ticketInput = document.getElementById('ticketnumber-input');
    ticketInput.onkeypress = ticketInput.onkeyup = ticketInput.onmouseup =
            RTTicket.associate.controller.onEvent;

    document.getElementById('ticketnumber-input').focus();

    // TODO: Add offline observer
};

RTTicket.associate.teardown = function teardown(windowUnloadEvent) {
    // TODO: Remove offline observer
    // Uninstall listeners
    RTTicket.associate.prefs.unregister('resendTo');
    RTTicket.associate.prefs.unregister('overwriteOriginal');
    RTTicket.associate.prefs.unregister('saveToSentMail');
    RTTicket.associate.prefs = null;

    var ticketInput = document.getElementById('ticketnumber-input');
    ticketInput.onkeypress = ticketInput.onkeyup = ticketInput.onmouseup = null;

    RTTicket.associate.msgWindow = null;

    // Uninstall controller
    top.controllers.removeController(RTTicket.associate.controller);
};

/*********************************************************************
 * Commands
 ********************************************************************/

RTTicket.associate.associate = function associate() {
    var ticketNumber = document.getElementById('ticketnumber-input').value;
    RTTicket.log.assert(ticketNumber >= 0,
                        'No valid ticket number to associate with');
    RTTicket.log.debug('associate ' + ticketNumber);

    var senderEmail = RTTicket.associate.args.id.email;
    var varBindings = {
        ticket: ticketNumber,
        mailfrom: senderEmail,
        mailfromdomain: senderEmail.substr(1 + senderEmail.lastIndexOf('@')),
        rtdomain: RTTicket.prefs.rtDomain
    };

    var msgCompFields = Components.classes['@mozilla.org/messengercompose/composefields;1']
                                  .createInstance(Components.interfaces.nsIMsgCompFields);
    msgCompFields.from = RTTicket.associate.getSender();
    msgCompFields.to = RTTicket.interpolateVars(RTTicket.associate.prefs.resendTo,
                                                varBindings);
    msgCompFields.cc =  msgCompFields.bcc = null;

    for (var i = 0; i < RTTicket.associate.args.selectedURIs.length; i++) {
        try {
            var tmpFile = RTTicket.associate.createTempFile();
        } catch (ex) {
            RTTicket.log.error('Unable to create temporary file');
            return;
        }
        RTTicket.log.debug('Using temporary file ' +
                           tmpFile.filespec.nativePath);

        RTTicket.associate.sendMail(RTTicket.associate.args.selectedURIs[i],
                                    varBindings,
                                    msgCompFields,
                                    tmpFile);
    }
};

RTTicket.associate.close = function close() {
    window.close();
};

/*********************************************************************
 * Helper functions
 ********************************************************************/

RTTicket.associate.sendMail = function sendMail(msgUri, varBindings,
                                                msgCompFields, tmpFile) {
    var messenger = Components.classes['@mozilla.org/messenger;1']
                              .createInstance(Components.interfaces.nsIMessenger);
    var msgSvc = messenger.messageServiceFromURI(msgUri);

    var modHeadersAndResendCopyListener = {
        inHeader: true,
        leftovers: '',
        buf: '',
        discardContinuations: false,
        inputStream: Components.classes['@mozilla.org/scriptableinputstream;1']
                               .createInstance(Components.interfaces.nsIScriptableInputStream),

        onStartRequest: function onStartRequest(request, context) {
            // Write out Resent-* headers
            var resentHdrs = RTTicket.associate.getResentHeaders(varBindings);
            tmpFile.outputStream.write(resentHdrs, resentHdrs.length);
        },

        onDataAvailable: function onDataAvailable(request, context, inputStream,
                                                  offset, count) {
            this.inputStream.init(inputStream);

            // Copy the composed message, making some modifications to the
            // message headers
            while (1) {
                try {
                    var read = this.inputStream.read(1024);
                } catch (eof) {
                    break;
                }
                this.buf = this.leftovers + read;
                this.leftovers = '';

                while (this.inHeader && this.buf.length > 0) {
                    // Parse out one line of header, terminated by the first
                    // of either CR or LF
                    var eol_r = this.buf.indexOf('\r');
                    var eol_n = this.buf.indexOf('\n');
                    var eol = (eol_r == -1)   ? eol_n :
                              (eol_n == -1)   ? eol_r :
                              (eol_r > eol_n) ? eol_n : eol_r;
                    if (eol == -1 || 1 + eol >= this.buf.length) {
                        // Either there is no CR or LF in this.buf,
                        // or one appears at the very end of this.buf.
                        // Read some more from the stream and try again.
                        this.leftovers = this.buf;
                        break;
                    }

                    var eolLen = ((this.buf[eol] == '\r' && this.buf[1+eol] == '\n') ||
                                  (this.buf[eol] == '\n' && this.buf[1+eol] == '\r')) ?
                                 2 : 1;
                    var line = this.buf.substr(0, eol) + '\r\n';
                    this.buf = this.buf.substr(eol + eolLen);

                    // Write out the header to the message to be sent
                    // unless it is one of the sensitive headers that
                    // should be omitted.
                    var lineLower = line.toLowerCase();
                    if ( /^[>]*From \S+ /.test(line) ||
                         /^bcc: /.test(lineLower) ||
                         /^fcc: /.test(lineLower) ||
                         /^content-length: /.test(lineLower) ||
                         /^status: /.test(lineLower) ||
                         /^x-mozilla-status(?:2)?: /.test(lineLower) ||
                         /^x-mozilla-draft-info: /.test(lineLower) ||
                         /^x-mozilla-newshost: /.test(lineLower) ||
                         /^x-uidl: /.test(lineLower) ||
                         /^x-vm-\S+: /.test(lineLower) ||
                         /^return-path: /.test(lineLower) ||
                         /^errors-to: /.test(lineLower) ||
                         /^delivered-to: /.test(lineLower) ||

                         // for drafts
                         /^fcc: /.test(lineLower) ||
                         /^x-identity-key: /.test(lineLower) ||
                         /^x-account-key: /.test(lineLower) ||
                         
                         this.discardContinuations && /^\s/.test(lineLower)) {
                        // RTTicket.log.debug('Discarded header: ' + line);

                        // Since we discarded this line, we should also discard
                        // any successive lines that start with whitespace
                        // (folded continuation lines).
                        this.discardContinuations = true;
                    } else {
                        tmpFile.outputStream.write(line, line.length);
                        this.discardContinuations = false;
                    }

                    // Empty line signifies end of headers
                    if (line == '\r\n') {
                        this.inHeader = false;
                        this.leftovers = this.buf;
                        this.buf = '';
                    }
                }

                if (!this.inHeader && this.buf.length > 0) {
                    // Done with headers.  Copy message body, normalizing line
                    // terminations to CRLF (as required by RFC 822)
                    var last = this.buf.length;
                    while (last > 0 && (this.buf[last-1] == '\r' ||
                                        this.buf[last-1] == '\n')) {
                        last--;
                    }
                    if (last != this.buf.length) {
                        this.leftovers = this.buf.substr(last);
                        this.buf = this.buf.substr(0, last);
                    }
                    this.buf = this.buf.replace(/\r\n|\n\r|\n/g, '\r\n');
                    tmpFile.outputStream.write(this.buf, this.buf.length);
                }
            }
        },

        onStopRequest: function onStopRequest(request, context, status) {
            this.leftovers = this.leftovers.replace(/\r\n|\n\r|\n/g, '\r\n');
            tmpFile.outputStream.write(this.leftovers, this.leftovers.length);
            tmpFile.outputStream.close();

            if (status) {
                RTTicket.log.error('onStopRequest: status=' + status);
                return;
            }

            if (RTTicket.associate.prefs.saveToSentMail
                    && RTTicket.associate.args.id.doFcc
                    && RTTicket.associate.args.id.fccFolder) {
                msgCompFields.fcc = RTTicket.associate.args.id.fccFolder;
            } else {
                msgCompFields.fcc = 'nocopy://';
            }

            // nsIMessenger.msgHdrFromURI() requires Thunderbird 1.5?
            // var msgToReplace = messenger.msgHdrFromURI ?
            //                      messenger.msgHdrFromURI(msgUri) : null;
            var origMsgHdr = msgSvc.messageURIToMsgHdr(msgUri);
            if (RTTicket.associate.prefs.overwriteOriginal) {
                msgCompFields.fcc2 = origMsgHdr.folder.URI;
            } else {
                msgCompFields.fcc2 = 'nocopy://';
            }

            // Send a message 
            var msgSend = Components.classes['@mozilla.org/messengercompose/send;1']
                                    .createInstance(Components.interfaces.nsIMsgSend);
            // TODO: mstate.msgSendObj[idx] = msgSend;

            var accountKey = RTTicket.associate.args.account ?
                                 RTTicket.associate.args.account.key : null;
            RTTicket.log.debug('Resent-To: ' + msgCompFields.to);

            var sendListener = {
                _errSvc: Components.classes['@mozilla.org/xpcom/error-service;1']
                                       .createInstance(Components.interfaces.nsIErrorService),

                QueryInterface: function QueryInterface(iid) {
                    switch (iid) {
                      case Components.interfaces.nsIMsgSendListener:
                        return this;
                      default:
                        throw Components.results.NS_NOINTERFACE;
                    }
                },

                onGetDraftFolderURI: function(folderURI) {},
                onProgress: function(msgID, progress, progressMax) {},
                onSendNotPerformed: function(msgID, status) {
                    RTTicket.log.debug('onSendNotPerformed: ' + msgID + ', ' + status);
                },
                onStartSending: function(msgID, msgSize) {},
                onStatus: function(msgID, msg) {
                    RTTicket.log.debug('onStatus: ' + msgID + ', ' + msg);
                },

                onStopSending: RTTicket.associate.prefs.overwriteOriginal ?
                    function onStopSending_overwrite(msgID, status, msg, filespec) {
                        // For some reason, Thunderbird calls this callback
                        // twice.  Put a stop to that...
                        this.onStopSending = function() {};

                        if (status) {
                            RTTicket.log.error('Message not sent: ' +
                                               this._errSvc.getErrorStringBundleKey(status));
                        } else {
                            RTTicket.log.debug('Message sent');

                            var messagesArray = Components.classes['@mozilla.org/supports-array;1']
                                                          .createInstance(Components.interfaces.nsISupportsArray);
                            messagesArray.AppendElement(origMsgHdr);
                            origMsgHdr.folder.deleteMessages(
                                /* messages= */                 messagesArray,
                                /* msgWindow= */                null,
                                /* deleteStorage= */            true,
                                /* isMove= */                   true,
                                /* listener= */                 null,
                                /* allowUndo= */                false
                            );
                            window.close();
                        }
                    } :
                    function onStopSending_nooverwrite(msgID, status, msg, filespec) {
                        // For some reason, Thunderbird calls this callback
                        // twice.  Put a stop to that...
                        this.onStopSending = function() {};

                        if (status) {
                            RTTicket.log.error('Message not sent: ' +
                                               this._errSvc.getErrorStringBundleKey(status));
                        } else {
                            RTTicket.log.debug('Message sent');
                            origMsgHdr.folder.addMessageDispositionState(
                                origMsgHdr,
                                origMsgHdr.folder.nsMsgDispositionState_Forwarded
                            );
                            window.close();
                        }
                    }
            }; // end sendListener

            // Using origMsgHdr here to save the outgoing message only works
            // for draft or template messages.
            msgSend.sendMessageFile(
                /* userIdentity= */                 RTTicket.associate.args.id,
                /* accountKey= */                   accountKey,
                /* fields= */                       msgCompFields,
                /* sendIFileSpec= */                tmpFile.filespec,
                /* deleteSendFileOnCompletion= */   true,
                /* digest_p= */                     false,
                /* mode= */                         msgSend.nsMsgDeliverNow,
                /* msgToReplace= */                 null,
                /* listener= */                     sendListener,
                /* statusFeedback= */               null, /* RTTicket.associate.msgWindow.MsgStatusFeedback, */
                /* password= */                     null
            );

            // Let the msgSend destructor run so that it deletes tmpFile
            msgSend = null;
        }
    };  // end modHeadersAndResendCopyListener

    msgSvc.CopyMessage(
        msgUri,
        modHeadersAndResendCopyListener,
        /* moveMessage= */ false,
        /* urlListener= */ null,
        RTTicket.associate.msgWindow,
        /* newURI= */ {});
};

RTTicket.associate.getResentHeaders = function getResentHeaders(varBindings) {
    return RTTicket.interpolateVars(
               'Errors-To: ' + RTTicket.associate.getSender() + '\r\n' +
               'Resent-From: ' + RTTicket.associate.getSender() + '\r\n' +
               'X-RT-User: ' + RTTicket.prefs.rtUser + '\r\n' +
               'Resent-To: ' + RTTicket.associate.prefs.resendTo + '\r\n' +
               'RT-Ticket: $rtdomain #$ticket\r\n',
               varBindings);
};

RTTicket.associate.getSender = function getSender() {
    var hdrParser = Components.classes['@mozilla.org/messenger/headerparser;1']
                              .getService(Components.interfaces.nsIMsgHeaderParser);
    var identity = RTTicket.associate.args.id;
    var encodedFullName = RTTicket.associate.qpEncode(identity.fullName);
    return hdrParser.makeFullAddressWString(encodedFullName, identity.email);
};

RTTicket.associate.createTempFile = function createTempFile() {
    var dirSvc = Components.classes['@mozilla.org/file/directory_service;1']
                           .getService(Components.interfaces.nsIProperties);
    var tmpDir = dirSvc.get('TmpD', Components.interfaces.nsIFile);

    // Create a temporary file
    var file = Components.classes['@mozilla.org/file/local;1']
                            .createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(tmpDir.path);
    file.appendRelativePath('rtticket.tmp');
    file.createUnique(file.NORMAL_FILE_TYPE, 0600);

    // Filespec
    var filespec = Components.classes['@mozilla.org/filespec;1']
                             .createInstance(Components.interfaces.nsIFileSpec);
    filespec.nativePath = file.path;

    // Open an output stream on the file
    const FILE_WRONLY   = 0x02;
    const FILE_CREATE   = 0x08;
    const FILE_TRUNCATE = 0x20;
    var outputStream = Components.classes['@mozilla.org/network/file-output-stream;1']
                                 .createInstance(Components.interfaces.nsIFileOutputStream);
    outputStream.init(file, FILE_WRONLY | FILE_CREATE | FILE_TRUNCATE, 0600, null);

    return {
        file: file,
        filespec: filespec,
        outputStream: outputStream
    };
};

RTTicket.associate.qpEncode = function qpEncode(str) {
    var mimeEnc = Components.classes['@mozilla.org/messenger/mimeconverter;1']
                            .getService(Components.interfaces.nsIMimeConverter);
    var uniConv = Components.classes['@mozilla.org/intl/scriptableunicodeconverter']
                            .getService(Components.interfaces.nsIScriptableUnicodeConverter);
    uniConv.charset = 'UTF-8';
    var msgCompFields = Components.classes['@mozilla.org/messengercompose/composefields;1']
                                  .createInstance(Components.interfaces.nsIMsgCompFields);
    return mimeEnc.encodeMimePartIIStr_UTF8(uniConv.ConvertFromUnicode(str),
                                            false,
                                            msgCompFields.characterSet,
                                            0, 72);
};

/* vim: set shiftwidth=4 expandtab: */
