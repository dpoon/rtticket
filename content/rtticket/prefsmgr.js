// Copyright 2006, 2014 The University of British Columbia and Derek Poon
// Released under the Mozilla Public License, v2.0.

function RTPrefsManager(branchName) {
    this.branchName = branchName;
    this.observers = [];
    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefService);
    var prefBranch = prefService.getBranch(branchName);
    try {
        // Gecko 1.8+
        this.prefBranch = prefBranch.QueryInterface(Components.interfaces.nsIPrefBranch2);
    } catch(ex) {
        // Legacy
        this.prefBranch = prefBranch.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
    }
}

RTPrefsManager.prototype = {
    register: function register(prefName, callback) {
        if (prefName.indexOf(this.branchName) == 0) {
            prefName = prefName.substring(this.branchName.length);
        }
        var prefBranch = this.prefBranch;
        var observer = this.observers[prefName] = {
            observe: function(subject, topic, pref) {
                if (topic == 'nsPref:changed' && pref == prefName) {
                    callback(prefBranch, prefName);
                }
            }
        };
        prefBranch.addObserver(prefName, observer, false);
        observer.observe(prefBranch, 'nsPref:changed', prefName);
    },

    unregister: function unregister(prefName) {
        if (prefName.indexOf(this.branchName) == 0) {
            prefName = prefName.substring(this.branchName.length);
        }
        // TODO: If multiple observers are registered for the same prefName,
        // this will only remove the last one.
        this.prefBranch.removeObserver(prefName, this.observers[prefName]);
    },

    get: function get(prefName, type) {
        if (prefName.indexOf(this.branchName) == 0) {
            prefName = prefName.substring(this.branchName.length);
        }
        switch (type) {
          case 'char': case 'string':
          case 'Char': case 'String':
            return this.prefBranch.getCharPref(prefName);
          case 'int': case 'Int':
            return this.prefBranch.getIntPref(prefName);
          case 'bool': case 'Bool':
            return this.prefBranch.getBoolPref(prefName);
        }
    },

    set: function set(prefName, type, value) {
        if (prefName.indexOf(this.branchName) == 0) {
            prefName = prefName.substring(this.branchName.length);
        }
        switch (type) {
          case 'char': case 'string':
          case 'Char': case 'String':
            return this.prefBranch.setCharPref(prefName, value);
          case 'int': case 'Int':
            return this.prefBranch.setIntPref(prefName, value);
          case 'bool': case 'Bool':
            return this.prefBranch.setBoolPref(prefName, value);
        }
    }
};

/* vim: set shiftwidth=4 expandtab: */
