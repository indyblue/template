const http = require('http');
const [fs, $path, $url] = [require('fs'), require('path'), require('url')];
const crypto = require('crypto');

const t = {};

const defs = {
	path: process.cwd(),
	port: 8080,
	handlers: []
};

t.new = (opts) => {
	const handlers = [];
	const that = Object.assign({}, defs, opts);
	that.server = http.createServer((rq, rs) => requestHandler(that, handlers, rq, rs));
	that.start = () => new Promise((resolve, reject) => {
		that.server.listen(that.port, (err) => {
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
t.webSocket = app => {
	app.server.on('upgrade', handleWS);
};

function handleWS(request, socket, buf) {
	var key = getHeader(request, 'Sec-WebSocket-Key');
	var magic = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
	var shasum = crypto.createHash('sha1');
	shasum.update(key + magic);
	var akey = shasum.digest('base64');
	var resp = ['HTTP/1.1 101 Switching Protocols',
		'Upgrade: websocket',
		'Connection: Upgrade',
		'Sec-WebSocket-Accept: ' + akey, '', ''].join('\r\n');
	console.log(key, resp);
	socket.write(resp);
	var inbuff = '';
	socket.on('data', function (buf) {
		var fin = buf.readUInt8(0) >> 7;
		var opcode = buf.readUInt8(0) & 15; //0=cont, 1=text, 2=binary
		var mask = buf.readUInt8(1) >> 7, bmask;
		var len = buf.readUInt8(1) & 127;
		var i = 2;
		if (len === 126) { len = buf.readUInt16BE(i); i += 2; }
		else if (len === 127) {
			len = (buf.readUInt32BE(i) << 32) + buf.readUInt32BE(6);
			i += 8;
		}
		if (mask) { bmask = buf.slice(i, i + 4); i += 4; }
		data = buf.slice(i, i + len);
		if (mask) for (var j = 0; j < data.length; j++)
			data[j] = data[j] ^ bmask[j % 4];
		if (opcode === 1) data = data.toString('utf8');
		// todo: handle fragmentation
		console.log(fin, opcode, mask, len, data);
	})
}
function getHeader(req, key) {
	var keyl = key.toLowerCase()
	for (var k in req.headers) if (k.toLowerCase() === keyl) return req.headers[k];
	return '';
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

if (module.parent == null) t.new().addHandler(true, t.files).start();
else module.exports = t;

