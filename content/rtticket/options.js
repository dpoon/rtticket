// Copyright 2006, 2014 The University of British Columbia and Derek Poon
// Released under the Mozilla Public License, v2.0.

/* Implements functionality that chrome://global/content/nsUserSettings.js
   provides (nsUserSettings.js disappeared in Thunderbird 1.5). */

RTTicket.options = {};

RTTicket.options.setup = function setup() {
    RTTicket.options.prefs = new RTPrefsManager('extensions.rtticket.');
    for (id in _elementIDs) {
        var el = document.getElementById(_elementIDs[id]);
        var prefString = el.getAttribute('prefstring');

        switch (el.tagName) {
          case 'textbox':
            RTTicket.options.prefs.register(prefString, function(branch, name) {
                switch (el.getAttribute('preftype')) {
                  case 'string':
                    el.value = branch.getCharPref(name);
                    break;
                  case 'int':
                    el.value = branch.getIntPref(name);
                    break;
                };
            });
            break;
          case 'checkbox':
            RTTicket.options.prefs.register(prefString, function(branch, name) {
                el.checked = branch.getBoolPref(name);
            });
            break;
        }
    }
}

RTTicket.options.teardown = function teardown() {
    for (id in _elementIDs) {
        var el = document.getElementById(_elementIDs[id]);
        var prefString = el.getAttribute('prefstring');
        RTTicket.options.prefs.unregister(prefString);
    }
};

RTTicket.options.save = function save() {
    for (id in _elementIDs) {
        var el = document.getElementById(_elementIDs[id]);
        var prefString = el.getAttribute('prefstring');

        switch (el.tagName) {
          case 'textbox':
            var prefType = el.getAttribute('preftype');
            RTTicket.options.prefs.set(prefString, prefType, el.value);
            break;
          case 'checkbox':
            RTTicket.options.prefs.set(prefString, 'bool', el.checked);
            break;
        }
    }
}
