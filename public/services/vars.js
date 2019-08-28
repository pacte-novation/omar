import { uiModules } from 'ui/modules';
const app = uiModules.get('apps/omarpy');

app.service('envVarsService', (envVars) => {
    return {
        get: () => envVars
    };
});