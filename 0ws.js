const [http, port] = [require('http'), 8080];
const [fs, $path, $url] = [require('fs'), require('path'), require('url')];

const requestHandler = (request, response) => {
	let url = request.url;
	fpath = $path.join(__dirname, url);
	fstat = $stat(fpath);
	console.log(new Date(), url, fstat.isFile() ? 'f' : fstat.isDirectory() ? 'd' : '-')
	if (fstat.isFile()) fs.createReadStream(fpath).pipe(response);
	else if (fstat.isDirectory()) handleDir(response);
	else if (url === '/$es') handleES(request, response);
	else response.end('404 not found!');
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
