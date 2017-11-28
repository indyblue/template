const [http, port] = [require('http'), 8080];
const [fs, $path, $url] = [require('fs'), require('path'), require('url')];

const requestHandler = (request, response) => {
	let url = request.url;
	fpath = $path.join(__dirname, url);
	fstat = $stat(fpath);
	console.log(new Date(), url, fstat.isFile()?'f':fstat.isDirectory()?'d':'-')
	if(fstat.isFile(fpath)) {
		fs.createReadStream(fpath).pipe(response);
	} else if(fstat.isDirectory()) {
		response.write(`<h3>Directory listing of '${url}'</h3>`);
		for(let i of fs.readdirSync(fpath)) response.write(
			`<div><a href='${$join(url, i)}'>${i}</a></div>`);
		response.end();
	} else response.end('404 not found!');
}

const server = http.createServer(requestHandler);
server.listen(port, (err) => {
	if (err) return console.log('something bad happened', err);
	console.log(`server is listening on ${port}, ${__dirname}`);
});

function $stat(fn) {
	if(fs.existsSync(fn)) return fs.lstatSync(fpath);
	else return { 
		isFile() { return false;}, 
		isDirectory() { return false;}
	};
};
function $join(a,b) { return $path.posix.normalize($path.posix.join(a,b)); }
