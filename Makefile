
.PHONY: clean, eslint, mocha, test

target:
	mkdir target

clean:
	rm -rf target

eslint: target
	node_modules/.bin/eslint *.js | tee target/eslint.txt

mocha: target
	node_modules/.bin/mocha | tee target/mocha.txt

test: mocha eslint

