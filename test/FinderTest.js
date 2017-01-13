let expect = require('chai').expect;

/*
 * We are testing autoloader component here
 * cannot use the autoloader itself to load classes! :)
 */
const Finder = require('../src/Finder');
const path = require('path');

let pathJoin = function () {
    let joined = undefined;
    for (let i = 0; i < arguments.length; ++i) {
        let arg = arguments[i];
        if (arg.length > 0) {
            if (joined === undefined) {
                joined = arg;
            } else {
                joined += '/' + arg;
            }
        }
    }

    return joined;
};

describe('[Autoloader] Finder', function () {
    it('findRoot', function () {
        let module = {
            parent: {
                parent: {
                    parent: undefined,
                    filename: '/var/node/foo/bar/app.js'
                }
            }
        };

        let mockedPath = {
            join: pathJoin,
            dirname: path.dirname,
            normalize: str => str,
            sep: '/'
        };

        let fs = {
            statSync: (fn) => {
                if (fn !== '/var/node/foo/bar/package.json') {
                    throw new Error('Incorrect argument "'+fn+'"');
                }

                return {
                    isDirectory: () => false
                };
            },
        };

        let finder = new Finder(fs, mockedPath, module);
        expect(finder.findRoot()).to.be.equal('/var/node/foo/bar');
    });

    it('findRoot caches result', function () {
        let module = {
            parent: {
                parent: {
                    parent: undefined,
                    filename: '/var/node/foo/bar/app.js'
                }
            }
        };

        let mockedPath = {
            join: pathJoin,
            dirname: path.dirname,
            normalize: str => str,
            sep: '/'
        };

        let callCount = 0;
        let fs = {
            statSync: () => {
                ++callCount;

                return {
                    isDirectory: () => false
                };
            },
        };

        let finder = new Finder(fs, mockedPath, module);

        finder.findRoot();
        finder.findRoot();

        expect(callCount).to.be.equal(1);
    });

    it('findRoot should rethrow if error is not ENOENT', function () {
        let module = {
            parent: {
                parent: {
                    parent: undefined,
                    filename: '/var/node/foo/bar/app.js'
                }
            }
        };

        let mockedPath = {
            join: pathJoin,
            dirname: path.dirname,
            normalize: str => str,
            sep: '/'
        };

        let fs = {
            statSync: () => {
                let e = new Error;
                e.code = 'EUNK';

                throw e;
            },
        };

        let finder = new Finder(fs, mockedPath, module);

        try {
            finder.findRoot();
        } catch (e) {
            return;
        }

        throw new Error('Expected error');
    });

    it('listModules', function () {
        let module = {
            parent: undefined,
            filename: '/var/node/foo/bar/app.js'
        };

        let mockedPath = {
            join: pathJoin,
            dirname: path.dirname,
            normalize: str => str,
            sep: '/'
        };

        let fs = {
            readdirSync: () => {
                return [
                    '.bin',
                    'jymfony-autoloader',
                    'chai',
                    'jymfony-event-dispatcher'
                ];
            },
            realpathSync: fn => fn,
            statSync: (fn) => {
                switch (fn) {
                    case '/var/node/foo/bar/package.json':
                        return {
                            isDirectory: () => false
                        };

                    case '/var/node/foo/bar/node_modules':
                        let e = new Error();
                        e.code = 'ENOENT';
                        throw e;

                    case '/var/node/foo/node_modules':
                        return {
                            isDirectory: () => false
                        };

                    case '/var/node/node_modules':
                        return {
                            isDirectory: () => true
                        };


                    default:
                        throw new Error('Unexpected argument');
                }
            },
        };

        let finder = new Finder(fs, mockedPath, module);
        expect(finder.listModules()).to.be.deep.equal([
            'jymfony-autoloader',
            'chai',
            'jymfony-event-dispatcher'
        ]);
    });

    it('listModules rethrows errors', function () {
        let module = {
            parent: undefined,
            filename: '/var/node/foo/bar/app.js'
        };

        let mockedPath = {
            join: pathJoin,
            dirname: path.dirname,
            normalize: str => str,
            sep: '/'
        };

        let fs = {
            readdirSync: () => {
                return [
                    '.bin',
                    'jymfony-autoloader',
                    'chai',
                    'jymfony-event-dispatcher'
                ];
            },
            realpathSync: fn => fn,
            statSync: fn => {
                if (fn === '/var/node/foo/bar/package.json') {
                    return {
                        isDirectory: () => false
                    };
                }

                throw new Error('TEST_ERROR');
            },
        };

        let finder = new Finder(fs, mockedPath, module);
        try {
            finder.listModules();
        } catch (e) {
            expect(e).to.be.instanceOf(Error);
            expect(e.message).to.be.equal('TEST_ERROR');

            return;
        }

        throw new Error('FAIL');
    });

    it('listModules with no modules installed', function () {
        let module = {
            parent: undefined,
            filename: '/var/node/foo/bar/app.js'
        };

        let mockedPath = {
            join: pathJoin,
            dirname: path.dirname,
            normalize: str => str,
            sep: '/'
        };

        let fs = {
            readdirSync: () => {
                return [];
            },
            realpathSync: fn => fn,
            statSync: () => {
                return {
                    isDirectory: () => false
                };
            },
        };

        let finder = new Finder(fs, mockedPath, module);
        let mods = finder.listModules();

        expect(mods).to.be.deep.equal([]);
    });

    it('find', function () {
        let fs = {
            statSync: (fn) => {
                expect(fn).to.be.equal('/var/node/package.json');

                return {
                    isDirectory: () => false
                };
            },
        };

        let finder = new Finder(fs, { normalize: str => str, sep: '/' }, {});
        let obj = finder.find('/var/node', 'package.json');

        expect(obj).to.be.deep.equal({
            filename: '/var/node/package.json',
            directory: false
        });
    });

    it('find appends .js ext', function () {
        let fs = {
            statSync: (fn) => {
                if ('/var/node/index' === fn) {
                    let e = new Error;
                    e.code = 'ENOENT';

                    throw e;
                } else if ('/var/node/index.js' === fn) {
                    return {
                        isDirectory: () => false
                    };
                }

                throw new Error('Invalid argument');
            },
        };

        let finder = new Finder(fs, { normalize: str => str, sep: '/' }, {});
        let obj = finder.find('/var/node', 'index');

        expect(obj).to.be.deep.equal({
            filename: '/var/node/index.js',
            directory: false
        });
    });

    it('find returns undefined if not found', function () {
        let fs = {
            statSync: (fn) => {
                let e = new Error;
                e.code = 'ENOENT';

                throw e;
            },
        };

        let finder = new Finder(fs, { normalize: path.normalize, sep: '/' }, {});
        let obj = finder.find('/var/node', 'index');

        expect(obj).to.be.deep.undefined;
    });

    it('find rethrows errors', function () {
        let fs = {
            statSync: () => {
                let e = new Error;
                e.code = 'EUNK';

                throw e;
            },
        };

        let finder = new Finder(fs, { normalize: path.normalize, sep: '/' }, {});
        try {
            finder.find('/var/node', 'index');
        } catch (e) {
            return;
        }

        throw new Error('Exception expected');
    });
});
