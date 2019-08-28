import { resolve } from 'path';
import { existsSync } from 'fs';
import serverRoute from './server/routes';
import SocketIo from 'socket.io';

export default function (kibana) {
  return new kibana.Plugin({
    require: ['elasticsearch'],
    name: 'omar',
    id: 'omar',
    uiExports: {
      app: {
        title: 'Omar',
        description: 'Prediction on simple variable',
        main: 'plugins/omar/app',
        icon: 'plugins/omar/ressources/omar_logo.svg'
      },
      hacks: [
        'plugins/omar/hack'
      ],
      styleSheetPaths: [resolve(__dirname, 'public/app.scss'), resolve(__dirname, 'public/app.css')].find(p => existsSync(p)),
    },

    config(Joi) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
        bulkQueueSize: Joi.number().integer().default(500),
        index: Joi.object({
          timefieldPredictOutputIndex: Joi.string().default('_timeField'),
          predictfieldPredictOutputIndex: Joi.string().default('_predictField'),
          prefixSortedIndex: Joi.string().default('.omar-tmp'),
          prefixPredictOutputIndex: Joi.string().default('omar-predict')
        }).default(),
        model:
          Joi.object({
            path: Joi.string().default('../plugins/omar/model'),
            index: Joi.string().default('.omar-model')
          }).default(),
        socketPort: Joi.number().integer().default(3000),
        qualitativeThreshold:
          Joi.object({
            value: Joi.number().default(0.15)
          }).default()
      }).default();
    },

    init(server, options) {

      const config = server.config();
      const socketPort = config.get('omar.socketPort');
      server.injectUiAppVars('omar', () => {
        return {
          envVars: {
            socketPort: socketPort
          }
        };
      });

      const io = SocketIo();
      io.on('connection', client => {
        server.log(['info', 'omar', 'socketio'], 'Connection! ' + client.handshake.headers.origin + " " + client.id + " port: " + socketPort);
        client.on("cancelTrain", () => { process.env.mustCancelTrain = "1"; });
        client.on("cancelPredict", () => { process.env.mustCancelPredict = "1"; });
        client.on("disconnect", () => {
          server.log(['info', 'omar', 'socketio'], 'Deconnection! ' + client.handshake.headers.origin + " " + client.id + " port: " + socketPort);
        });
      });
      io.listen(socketPort, { pingTimeout: 2000000, pingInterval: 1 });
      options.io = io;

      serverRoute(server, options);
    }

  });
}
