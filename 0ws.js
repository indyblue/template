const [http, port] = [require('http'), 8080];
const [fs, $path, $url] = [require('fs'), require('path'), require('url')];
const crypto = require('crypto');

const requestHandler = (request, response) => {
	let url = request.url;
	fpath = $path.join(__dirname, url);
	fstat = $stat(fpath);
	console.log(new Date(), url, fstat.isFile() ? 'f' : fstat.isDirectory() ? 'd' : '-')
	/*
	if(/\.js$/i.test(url) && request.headers['cache-control']!=='no-cache') {
		response.statusCode = 304;
		response.end('304 Not Modified');
		//console.log('add headers', request.getHeader('cache-control'));
		return;
		//response.setHeader('cache-control', 'max-age=315360000, public'); 
		//response.setHeader('expires', 'Thu, 31 Dec 2037 23:55:55 GMT'); 
		//response.setHeader('etag', '"5a637bd4-1538f"'); 
	}
	*/
	if (fstat.isFile()) fs.createReadStream(fpath).pipe(response);
	else if (fstat.isDirectory()) handleDir(response);
	else if (url === '/$event') handleES(request, response);
	else response.end('404 not found!');
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

function handleDir(response) {
	response.write(`<html><head></head><body><h3>Directory listing of '${url}'</h3>`);
	for (let i of fs.readdirSync(fpath)) response.write(
		`<div><a href='${$join(url, i)}'>${i}</a></div>`);
	response.write(`</body></html>`);
	response.end();
}

const server = http.createServer(requestHandler);
server.on('upgrade', function (req, socket, buf) {
	handleWS(req, socket, buf);
	console.log(arguments);
});
server.listen(port, (err) => {
	if (err) return console.log('something bad happened', err);
	console.log(`server is listening on ${port}, ${__dirname}`);
});

function $stat(fn) {
	if (fs.existsSync(fn)) return fs.lstatSync(fpath);
	else return {
		isFile() { return false; },
		isDirectory() { return false; }
	};
};
function $join(a, b) { return $path.posix.normalize($path.posix.join(a, b)); }
