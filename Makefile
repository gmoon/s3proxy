PACKAGE_NAME     := $(shell jq --raw-output '.name'    package.json)
PACKAGE_VERSION  := $(shell jq --raw-output '.version' package.json)

.PHONY : packagedeps npmdeps clean eslint mocha test target tar

npmdeps: 
	npm install

packagedeps:
	which jq 2>/dev/null || apt-get -y install jq

builddeps: packagedeps npmdeps

target :
	mkdir -p target

clean :
	rm -rf target

eslint : target
	node_modules/.bin/eslint *.js | tee target/test-eslint.txt

mocha : target
	node_modules/.bin/mocha | tee target/test-mocha.txt

test : mocha eslint

tar : target test
	rm -f target/$(PACKAGE_NAME)-$(PACKAGE_VERSION).tar.gz
	rm -rf target/source
	mkdir -p target/source/$(PACKAGE_NAME)-$(PACKAGE_VERSION)/
	cp s3proxy.js README.md LICENSE target/source/$(PACKAGE_NAME)-$(PACKAGE_VERSION)/
	cd target/source; tar -cvzf ../$(PACKAGE_NAME)-$(PACKAGE_VERSION).tar.gz *	
