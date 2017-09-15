PACKAGE_NAME     := $(shell jq --raw-output '.name'    package.json)
PACKAGE_VERSION  := $(shell jq --raw-output '.version' package.json)

.PHONY : clean eslint mocha test target tar

builddeps:
	which jq || apt-get -y install jq
	npm install

target :
	mkdir -p target

clean :
	rm -rf target

eslint : target builddeps
	node_modules/.bin/eslint *.js | tee target/test-eslint.txt

mocha : target builddeps
	node_modules/.bin/mocha | tee target/test-mocha.txt

test : mocha eslint

tar : target builddeps test
	rm -f target/$(PACKAGE_NAME)-$(PACKAGE_VERSION).tar.gz
	rm -rf target/source
	mkdir -p target/source/$(PACKAGE_NAME)-$(PACKAGE_VERSION)/
	cp s3proxy.js README.md LICENSE target/source/$(PACKAGE_NAME)-$(PACKAGE_VERSION)/
	cd target/source; tar -cvzf ../$(PACKAGE_NAME)-$(PACKAGE_VERSION).tar.gz *	
