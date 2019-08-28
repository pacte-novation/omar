import Joi from 'joi';
import { predict } from './services/predict';
import { train } from './services/train';
import { getIndices } from './services/indices';
import { getFields } from './services/fields';
import { getModelParams } from './services/omar-model';

const logRequest = (req) => {
  req.server.log(['info', 'omar', 'http'], req.route.method.toUpperCase() + ' ' + req.route.path);
}

export default function (server, options) {

  server.route({
    path: '/api/omar/indices',
    method: 'GET',
    handler: async (req, reply) => {
      try {
        logRequest(req);
        const result = await getIndices(req);
        return reply.response(result).type('application/json');
      } catch (err) {
        return reply(err);
      }
    }
  });

  server.route({
    path: '/api/omar/fields/{index}',
    config: {
      validate: {
        params: {
          index: Joi.string().required(),
        },
      },
    },
    method: 'GET',
    handler: async (req, reply) => {
      try {
        logRequest(req);
        const result = await getFields(req);
        return reply.response(result).type('application/json');
      } catch (err) {
        reply(err)
      }
    }
  });

  server.route({
    path: '/api/omar/train',
    config: {
      validate: {
        payload: {
          index: Joi.string().required(),
          timeField: Joi.string().required(),
          predictField: Joi.string().required(),
          featureFields: Joi.string().required(),
          timeStep: Joi.number().required()
        },
      },
    },
    method: 'POST',
    handler: (req, reply) => {
      try {
        process.env.mustCancelTrain = "0";
        logRequest(req);
        req.io = options.io;
        train(req);
        return reply.response("Train has been launched").type('text/plain');
      } catch (err) {
        reply(err);
      }
    }
  });

  server.route({
    path: '/api/omar/predict',
    method: 'POST',
    handler: async (req, reply) => {
      try {
        process.env.mustCancelPredict = "0";
        logRequest(req);
        req.io = options.io;
        predict(req);
        return reply.response("Predict has been launched").type('text/plain');
      } catch (err) {
        reply(err);
      }
    }
  });

  server.route({
    path: '/api/omar/omar-model',
    method: 'GET',
    handler: async (req, reply) => {
      try {
        logRequest(req);
        const result = await getModelParams(req);
        return reply.response(result).type('application/json');
      } catch (err) {
        reply(err);
      }
    }
  });

}

