const http = require('http');
const [fs, $path] = [require('fs'), require('path'), require('url')];

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
  that.server = http.createServer((rq, rs) =>
    requestHandler(that, handlers, rq, rs));
  that.start = () => new Promise((resolve, reject) => {
    that.server.listen(that.port, that.host, (err) => {
      if (err) {
        console.log('something bad happened', err);
        return reject(err);
      }
      console.log(`server is listening on ${that.port}, ${that.host}`);
      resolve([that.port, that.host]);
    });
  });
  that.addHandler = (filter, cb) => {
    handlers.push({ filter, cb });
    return that;
  };
  that.clearHandlers = () => {
    handlers.splice(0, handlers.length);
    return that;
  };
  makeSocket(that);
  return that;
};

/******************************************************************************/
const requestHandler = (that, handlers, request, response) => {
  request.dirname = that.path; const url = request.url;
  request.isClosed = false;
  request.on('close', () => { request.isClosed = true; });
  let pr = Promise.resolve();
  for (let h of handlers) {
    let urlMatch = meetsFilter(h.filter, request);
    if (urlMatch && typeof h.cb === 'function') {
      pr = pr.then(() => new Promise((resolve, reject) => {
        request.urlMatch = urlMatch;
        console.log(url, h.filter, JSON.stringify(urlMatch));
        h.cb(request, response, resolve, reject);
      }));
    };
  }
  pr.then((...a) => {
    res404(request, response);
  }, (...a) => {
    res404(request, response);
    console.log('error', ...a);
  });
  request.on('end', () => {
  });
};

function meetsFilter(filter, request) {
  const url = request.url;
  const verb = request.method.toLowerCase();
  const vrx = new RegExp('\\b' + verb + '\\b', 'i');
  const ftype = typeof filter;
  if (ftype === 'boolean') return filter;
  let urlF = urlFilter(filter, url);
  if (urlF !== null) return urlF;
  else if (ftype === 'function') return ftype(request);
  else if (ftype === 'object') {
    if ('verb' in filter && !vrx.test(filter.verb)) return false;
    if ('url' in filter
      && (urlF = urlFilter(filter.url, url)) !== null) return urlF;
  } else return true; // always applies by default
};
function urlFilter(filter, url) {
  const ftype = typeof filter; const urllc = url.toLowerCase();
  const url2 = url.replace(/^\//, ''); const url2lc = urllc.replace(/^\//, '');
  if (ftype === 'string') {
    return urllc.startsWith(filter.toLowerCase())
      || url2lc.startsWith(filter.toLowerCase());
  } else if (filter instanceof RegExp) {
    return filter.exec(url) || filter.exec(url2) || false;
  } else return null;
}
/******************************************************************************/

function res404(req, res) {
  if (!res.finished) {
    if (!res.headersSent) res.statusCode = 404;
    res.end('resource not found');
  }
}
/******************************************************************************/

const files = (dirname, prefix) => (req, res, next) => {
  if (!dirname) dirname = req.dirname;
  let url = req.url;
  if (typeof prefix === 'number' && req.urlMatch instanceof Array) {
    url = req.urlMatch[prefix];
  }
  const fpath = $path.join(dirname, url);
  const fstat = $stat(fpath);
  if (fstat.isFile()) fs.createReadStream(fpath).pipe(res);
  else if (fstat.isDirectory()) handleDir(fpath, url, res);
  else next();
};
t.files = files();
t.modFiles = p => files(__dirname, p);
const rxRootDir = /^\+\//;
const rxNMDir = /^\+nm\//;
t.custFiles = (dir, p) => {
  if (rxRootDir.test(dir)) {
    dir = $path.join(process.cwd(), dir.replace(rxRootDir, ''));
  } else if (rxNMDir.test(dir)) {
    dir = $path.join(process.cwd(), 'node_modules', dir.replace(rxNMDir, ''));
  }
  return files(dir, p);
};

function handleDir(fpath, url, res) {
  res.write(`<html><head></head><body><h3>Directory listing of '${url}'</h3>`);
  for (let i of fs.readdirSync(fpath)) {
    res.write(
      `<div><a href='${$join(url, i)}'>${i}</a></div>`);
  }
  res.write('</body></html>');
  res.end();
}

function $stat(fn) {
  if (fs.existsSync(fn)) return fs.lstatSync(fn);
  else {
    return {
      isFile() { return false; },
      isDirectory() { return false; }
    };
  }
};
function $join(a, b) { return $path.posix.normalize($path.posix.join(a, b)); }

/******************************************************************************/
function makeSocket(that) {
  try {
    var WebSocketServer = require('websocket').server;
    var jh = that.jh = require('./json_websocket');
    if (that.wst) {
      jh.addCbJson(/.*/i, function(p, e) {
        console.log('json msg', e, p);
        jh.sendJson('ack', { txt: 'message received', obj: p }, this);
      });
    }
    that.wsock = new WebSocketServer({
      httpServer: that.server,
      // autoAcceptConnections: false,
      maxReceivedFrameSize: 1 << 20,
      maxReceivedMessageSize: 1 << 23
    });
    that.wsock.on('request', function(request) {
      var ws = request.accept(null, request.origin);
      jh.addConn(ws);
      console.log((new Date()) + ' Connection accepted.', request.origin);
      ws.on('message', function(event) {
        if (event.type === 'utf8') event.data = event.utf8Data;
        else if (event.type === 'binary') event.data = event.binaryData;
        jh.ondata.bind(this)(event);
      });
      ws.on('close', function(reasonCode, description) {
        jh.remConn(ws);
        console.log((new Date()) + ' Peer '
          + ws.remoteAddress + ' disconnected.');
      });
    });
  } catch (ex) {
    console.warn('websockets not enabled');
  }
}

// function handleES(request, response) {
//   request.socket.setTimeout(1e12);
//   response.on('close', function(e) {
//     console.log('EventSource closed', e);
//   });
//   response.writeHead(200, {
//     'Content-Type': 'text/event-stream',
//     'Cache-Control': 'no-cache',
//     'Connection': 'keep-alive'
//   });
//   response.write('\n');
//   setInterval(function() {
//     var output = fmtEsMsg('ping', { time: Date.now() });
//     response.write(output);
//   }, 2000);
// }
// function fmtEsMsg(event, data) {
//   var output = 'event: ' + event + '\n'
//     + 'data: ' + JSON.stringify(data) + '\n\n';
//   return output;
// }

if (module.parent == null) {
  t.new({ wst: true })
    .addHandler(/tmp\/(.*)/, t.modFiles(1))
    .addHandler(/tex\/(.*)/, t.custFiles('+nm/textile.das/', 1))
    .addHandler(true, t.files)
    .start();
} else module.exports = t;
