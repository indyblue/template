(function () {
  var jh = {
    ondata: function (event) {
      if (typeof event.data === 'string') {
        try {
          var obj = JSON.parse(event.data);
          for (var i = 0; i < jh.cbJson.length; i++) {
            var h = jh.cbJson[i], m = false;
            if (!h.type) m = true;
            if (h.type === obj.type) m = true;
            else if (h.type instanceof RegExp && h.type.test(obj.type)) m = true;
            if (m) h.cb.bind(this)(obj.payload, obj.event, event);
          }
        } catch (ex) {
          if (jh.cbText) jh.cbText.bind(this)(event);
        }
      } else if (jh.cbBinary) jh.cbBinary.bind(this)(event);
    },
    connections: [],
    cbJson: [],
    addCbJson: function (event, cb) {
      jh.cbJson.push({ event: event, cb: cb });
    },
    cbText: null,
    cbBinary: null,
    sendJson: function (event, payload, ws) {
      var conns = jh.connections;
      if (ws) conns = [ws];
      var data = { event: event, payload: payload };
      var txt = JSON.stringify(data);
      for (var i = 0; i < conns.length; i++) conns[i].send(txt);
    },
    addConn: function (ws) {
      if (jh.connections.indexOf(ws) === -1) jh.connections.push(ws);
    },
    remConn: function (ws) {
      var i = jh.connections.indexOf(ws);
      if (i >= 0) jh.connections.splice(i, 1);
    }
  }

  if (typeof module === 'object') module.exports = jh;
  if (typeof window === 'object') window.jsonWsHandler = jh;
})();