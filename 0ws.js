const http = require('http');
const [fs, $path, $url] = [require('fs'), require('path'), require('url')];
const crypto = require('crypto');

const t = {
	server: null,
	dirname: __dirname,
	port: 8080,
	start: null,
	cbRequest: null,
	handlers: []
};
function urlFilter(fitler, url) {
	const ftype = typeof filter;
	if (ftype === 'string') return url.startsWith(filter.toLowerCase());
	else if (ftype instanceof RegExp) return ftype.exec(url);
	else return null;
}
function meetsFilter(filter, request) {
	const url = request.url.toLowerCase(),
		verb = request.method.toLowerCase(), vrx = new RegExp('\\b' + verb + '\\b', 'i'),
		ftype = typeof filter;
	let urlF = urlFilter(filter, url);
	if (urlF !== null) return urlF;
	else if (ftype === 'function') return ftype(request);
	else if (typeof opt === 'object') {
		if ('verb' in opt && !vrx.test(opt.verb)) return false;
		if ('url' in opt && (urlF = urlFilter(opt.url, url)) !== null) return urlF;
	}
	else return true; // always applies by default
};
t.addHandler = (filter, cb) => {
};

const requestHandler = (request, response) => {
	let dirname = t.dirname, url = request.url;



	let reqData = '';
	request.on('data', (chunk) => {
		reqData += chunk.toString();
	});
	request.on('end', () => {
	});
}



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

function handleDir(url, response) {
	response.write(`<html><head></head><body><h3>Directory listing of '${url}'</h3>`);
	for (let i of fs.readdirSync(fpath)) response.write(
		`<div><a href='${$join(url, i)}'>${i}</a></div>`);
	response.write(`</body></html>`);
	response.end();
}

const server = t.server = http.createServer(requestHandler);
server.on('upgrade', function (req, socket, buf) {
	handleWS(req, socket, buf);
	console.log(arguments);
});
t.start = function () {
	return new Promise((resolve, reject) => {
		server.listen(t.port, (err) => {
			if (err) {
				reject(err);
				return console.log('something bad happened', err);
			}
			resolve([t.port, t.dirname, 'whats my name']);
			console.log(`server is listening on ${t.port}, ${t.dirname}`);
		});
	});
}

if (module.parent == null) t.start();
else module.exports = t;


function $stat(fn) {
	if (fs.existsSync(fn)) return fs.lstatSync(fpath);
	else return {
		isFile() { return false; },
		isDirectory() { return false; }
	};
};
function $join(a, b) { return $path.posix.normalize($path.posix.join(a, b)); }
