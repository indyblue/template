const http = require('http');
const [fs, $path, $url] = [require('fs'), require('path'), require('url')];
const crypto = require('crypto');

const t = {};

const defs = {
	path: process.cwd(),
	port: 8080,
	host: '127.0.0.1',
	handlers: []
};

t.new = (opts) => {
	const handlers = [];
	const that = Object.assign({}, defs, opts);
	that.server = http.createServer((rq, rs) => requestHandler(that, handlers, rq, rs));
	that.start = () => new Promise((resolve, reject) => {
		that.server.listen(that.port, that.host, (err) => {
			if (err) {
				console.log('something bad happened', err);
				return reject(err);
			}
			console.log(`server is listening on ${that.port}, ${that.dirname}`);
			resolve([that.port, that.path]);
		});
	});
	that.addHandler = (filter, cb) => {
		handlers.push({ filter, cb });
		return that;
	}
	that.clearHandlers = () => {
		handlers.splice(0, handlers.length);
		return that;
	}
	makeSocket(that);
	return that;
}

/******************************************************************************/
const requestHandler = (that, handlers, request, response) => {
	const dirname = request.dirname = that.path, url = request.url;
	request.isClosed = false;
	request.on('close', () => { request.isClosed = true });
	let pr = Promise.resolve();
	for (let h of handlers) {
		let urlMatch = meetsFilter(h.filter, request);
		if (urlMatch && typeof h.cb === 'function') {
			request.urlMatch = urlMatch;
			pr = pr.then(() => new Promise((resolve, reject) => {
				console.log(url, h.filter);
				h.cb(request, response, resolve, reject);
			}));
		};
	}
	pr.then((...a) => {
		res404(request, response);
	}, (...a) => {
		res404(request, response);
		console.log('error', ...a)
	});
	let reqData = '';
	request.on('data', (chunk) => {
		reqData += chunk.toString();
	});
	request.on('end', () => {
	});
}

function meetsFilter(filter, request) {
	const url = request.url,
		verb = request.method.toLowerCase(), vrx = new RegExp('\\b' + verb + '\\b', 'i'),
		ftype = typeof filter;
	if (ftype === 'boolean') return filter;
	let urlF = urlFilter(filter, url);
	if (urlF !== null) return urlF;
	else if (ftype === 'function') return ftype(request);
	else if (typeof opt === 'object') {
		if ('verb' in opt && !vrx.test(opt.verb)) return false;
		if ('url' in opt && (urlF = urlFilter(opt.url, url)) !== null) return urlF;
	}
	else return true; // always applies by default
};
function urlFilter(filter, url) {
	const ftype = typeof filter, urllc = url.toLowerCase(),
		url2 = url.replace(/^\//, ''), url2lc = urllc.replace(/^\//, '');
	if (ftype === 'string') return urllc.startsWith(filter.toLowerCase()) || url2lc.startsWith(filter.toLowerCase());
	else if (filter instanceof RegExp) return filter.exec(url) || filter.exec(url2) || false;
	else return null;
}
/******************************************************************************/

function res404(req, res) {
	if (!res.finished) {
		if (!res.headersSent) res.statusCode = 404;
		res.end('resource not found');
	}
}
/******************************************************************************/

t.files = (req, res, next) => {
	let dirname = req.dirname;
	let url = req.url;
	fpath = $path.join(dirname, url);
	fstat = $stat(fpath);

	if (fstat.isFile()) fs.createReadStream(fpath).pipe(res);
	else if (fstat.isDirectory()) handleDir(url, res);
	else next();
};
function handleDir(url, res) {
	res.write(`<html><head></head><body><h3>Directory listing of '${url}'</h3>`);
	for (let i of fs.readdirSync(fpath)) res.write(
		`<div><a href='${$join(url, i)}'>${i}</a></div>`);
	res.write(`</body></html>`);
	res.end();
}

function $stat(fn) {
	if (fs.existsSync(fn)) return fs.lstatSync(fpath);
	else return {
		isFile() { return false; },
		isDirectory() { return false; }
	};
};
function $join(a, b) { return $path.posix.normalize($path.posix.join(a, b)); }

/******************************************************************************/
function makeSocket(that) {
	try {
		var WebSocketServer = require('websocket').server;
		var jh = require('./json_websocket');
		if (that.wst) jh.addCbJson(/.*/i, function (p, e) {
			console.log('json msg', e, p);
			jh.sendJson('ack', { txt: 'message received', obj: p }, this);
		});
		that.wsock = new WebSocketServer({
			httpServer: that.server,
			//autoAcceptConnections: false,
			maxReceivedFrameSize: 1 << 20,
			maxReceivedMessageSize: 1 << 23,
		});
		that.wsock.on('request', function (request) {
			var ws = request.accept(null, request.origin);
			jh.addConn(ws);
			console.log((new Date()) + ' Connection accepted.', request.origin);
			ws.on('message', function (event) {
				if (event.type === 'utf8') event.data = event.utf8Data;
				else if (event.type === 'binary') event.data = event.binaryData;
				jh.ondata.bind(this)(event);
			});
			ws.on('close', function (reasonCode, description) {
				jh.remConn(ws);
				console.log((new Date()) + ' Peer ' + ws.remoteAddress + ' disconnected.');
			});
		});
	} catch (ex) {
		console.warn('websockets not enabled');
	}
}

function handleES(request, response) {
	request.socket.setTimeout(1e12);
	response.on('close', function (e) {
		console.log('EventSource closed', e);
	});
	response.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
	});
	response.write('\n');
	setInterval(function () {
		var output = fmtEsMsg('ping', { time: Date.now() });
		response.write(output);
	}, 2000);
}
function fmtEsMsg(event, data) {
	var output = 'event: ' + event + '\n'
		+ 'data: ' + JSON.stringify(data) + '\n\n';
	return output;
}

if (module.parent == null) t.new({ wst: true }).addHandler(true, t.files).start();
else module.exports = t;

