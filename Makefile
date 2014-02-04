######################################################################
# Copyright 2006, 2014 The University of British Columbia and Derek Poon
# Released under the Mozilla Public License v2.0.
#
# GNU Makefile for RT Ticket Manager extension.  For a fancier Makefile, see
# http://kb.mozillazine.org/Makefile_for_packaging_an_extension
######################################################################

# When changing these metadata, be sure to edit install.rdf accordingly
PROJECT = rtticket
include Version.mak

VERSION = $(VER_MAJOR)$(if \
          $(VER_MINOR),.$(VER_MINOR),)$(if \
          $(VER_PATCH),.$(VER_PATCH),)

NAME = Request Tracker Ticket Manager
RELEASE_BASE_DIR = ~/etc/src/mozapps
RELEASE_DIR = $(RELEASE_BASE_DIR)/$(PROJECT)
RELEASE_BASE_URL = https://www.ece.ubc.ca/~derekp/mozapps/
RELEASE_URL = $(RELEASE_BASE_URL)/$(PROJECT)
HOMEPAGE = $(RELEASE_URL)/

BUILD_DIR = build

PERL = perl
JAR = zip -9

BUILD_XPI = $(BUILD_DIR)/$(PROJECT).xpi
RELEASE_XPI = $(RELEASE_DIR)/$(PROJECT)-$(VERSION).xpi
UPDATE_RDF = $(RELEASE_BASE_DIR)/update.rdf

JAR_CONTENTS := $(shell find content locale skin -type f)

STATIC_XPI_CONTENTS = \
	chrome.manifest \
	defaults/preferences/$(PROJECT).js \
	$(NULL)

XPI_CONTENTS = \
	install.rdf \
	chrome/$(PROJECT).jar \
	$(STATIC_XPI_CONTENTS) \
	$(NULL)

all: $(BUILD_XPI)

$(BUILD_XPI): $(XPI_CONTENTS:%=$(BUILD_DIR)/%)
	@if [ ! -d '$(@D)' ]; then mkdir -p '$(@D)' ; fi
	( cd '$(BUILD_DIR)' && $(JAR) - $(XPI_CONTENTS) ) > '$@'

$(BUILD_DIR)/install.rdf: Version.mak Makefile install.rdf.in
	@if [ ! -d '$(@D)' ]; then mkdir -p '$(@D)' ; fi
	sed -e 's/\$$(PROJECT)/$(subst /,\/,$(PROJECT))/g' \
	    -e 's/\$$(VERSION)/$(subst /,\/,$(VERSION))/g' \
	    -e 's/\$$(NAME)/$(subst /,\/,$(NAME))/g' \
	    -e 's/\$$(RELEASE_BASE_DIR)/$(subst /,\/,$(RELEASE_BASE_DIR))/g' \
	    -e 's/\$$(RELEASE_DIR)/$(subst /,\/,$(RELEASE_DIR))/g' \
	    -e 's/\$$(RELEASE_BASE_URL)/$(subst /,\/,$(RELEASE_BASE_URL))/g' \
	    -e 's/\$$(RELEASE_URL)/$(subst /,\/,$(RELEASE_URL))/g' \
	    -e 's/\$$(HOMEPAGE)/$(subst /,\/,$(HOMEPAGE))/g' \
	    < install.rdf.in > '$@'

$(BUILD_DIR)/chrome/$(PROJECT).jar: content/$(PROJECT)/release.dtd $(JAR_CONTENTS)
	@if [ ! -d '$(@D)' ]; then mkdir -p '$(@D)' ; fi
	$(JAR) - $+ > '$@'

content/$(PROJECT)/release.dtd: Version.mak Makefile
	( \
	    echo "<!ENTITY release.project  \"$(PROJECT)\">" ; \
	    echo "<!ENTITY release.version  \"$(VERSION)\">" ; \
	    echo "<!ENTITY release.name     \"$(NAME)\">" ; \
	    echo "<!ENTITY release.homepage \"$(HOMEPAGE)\">" ; \
	) > '$@'

$(STATIC_XPI_CONTENTS:%=$(BUILD_DIR)/%): $(BUILD_DIR)/%: %
	@if [ ! -d '$(@D)' ]; then mkdir -p '$(@D)' ; fi
	cp '$<' '$@'

.PHONY: clean
clean:
	@if [ -e '$(BUILD_DIR)' ]; then \
	    echo rm -rf '$(BUILD_DIR)' ; \
	    rm -rf '$(BUILD_DIR)' ; \
	fi

.PHONY: release release-major release-minor release-patch release-files
RELEASE_FILES = $(RELEASE_XPI) $(UPDATE_RDF)

release:
	@echo 'Invoke as "make release-patch", "make release-minor", or "make release-major"'

release-major:
	( \
	    echo VER_MAJOR = $(shell echo '0$(VER_MAJOR)' + 1 | bc ) ; \
	    echo VER_MINOR = 0 ; \
	    echo VER_PATCH = ; \
	) > Version.mak
	$(MAKE) release-files

release-minor:
	( \
	    echo VER_MAJOR = $(VER_MAJOR) ; \
	    echo VER_MINOR = $(shell echo '0$(VER_MINOR)' + 1 | bc ) ; \
	    echo VER_PATCH = ; \
	) > Version.mak
	$(MAKE) release-files

release-patch:
	( \
	    echo VER_MAJOR = $(VER_MAJOR) ; \
	    echo VER_MINOR = $(VER_MINOR) ; \
	    echo VER_PATCH = $(shell echo '0$(VER_PATCH)' + 1 | bc ) ; \
	) > Version.mak
	$(MAKE) release-files

release-files:
	$(MAKE) $(RELEASE_FILES)

$(RELEASE_XPI): $(BUILD_XPI)
	@if [ ! -d '$(@D)' ]; then mkdir -p '$(@D)' ; fi
	cp '$<' '$@'

$(UPDATE_RDF): $(UPDATE_RDF).mason $(RELEASE_XPI) Version.mak
	@if [ ! -d '$(@D)' ]; then mkdir -p '$(@D)' ; fi
	@$(RM) '$@'
	$(PERL) -MHTML::Mason::Interp -e 'HTML::Mason::Interp->new(comp_root => "$(<D)", data_dir => "$(if $(filter /%,$(BUILD_DIR)),$(BUILD_DIR),$(CURDIR)/$(BUILD_DIR))")->exec("/$(<F)", base_url => "$(RELEASE_BASE_URL)")' > '$@'

NULL =
