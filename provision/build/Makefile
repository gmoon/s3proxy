SHELL            := /bin/bash
PACKAGE_NAME     := $(shell jq --raw-output '.name'    package.json 2>/dev/null)
PACKAGE_VERSION  := $(shell jq --raw-output '.version' package.json 2>/dev/null)
UUID             := $(shell date +%s)
OS               := $(shell source /etc/os-release; echo "$$ID")
PKG_LIST_DOCKER  := apt-transport-https ca-certificates curl gnupg2 software-properties-common
PKG_LIST         := npm jq 

.PHONY : debuginfo install-packages install-node install-docker-repo buildenv

debuginfo:
	@echo node --version $(shell node --version)
	@echo npm --version $(shell npm --version)
	@echo debian version $(shell cat /etc/debian_version)
	@echo os-release 
	@echo $(shell cat /etc/os-release)
	@echo Operating System $(OS)
	echo $(shell docker version)

install-packages:
	apt-get update
	apt-get -y install $(PKG_LIST)

install-node: install-packages
	npm install -g n
	n stable

install-docker-repo: install-packages
	curl -fsSL https://download.docker.com/linux/$(OS)/gpg | sudo apt-key add -
	apt-key fingerprint 0EBFCD88
	add-apt-repository \
		"deb [arch=amd64] https://download.docker.com/linux/$(OS) \
		$(shell lsb_release -cs) \
		stable"

buildenv: install-node

