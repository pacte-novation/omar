import React from 'react';
import { uiModules } from 'ui/modules';
import chrome from 'ui/chrome';
import { render, unmountComponentAtNode } from 'react-dom';

import 'ui/autoload/styles';
import { Main } from './components/main';

import './services/vars';
const app = uiModules.get('apps/omar');

app.config($locationProvider => {
  $locationProvider.html5Mode({
    enabled: false,
    requireBase: false,
    rewriteLinks: false,
  });
});
app.config(stateManagementConfigProvider =>
  stateManagementConfigProvider.disable()
);

function RootController($scope, $element, $http, envVarsService) {
  const domNode = $element[0];

  render(
    <Main
      title="omar"
      httpClient={$http}
      envVarsService={envVarsService}
    />,
    domNode
  );

  $scope.$on('$destroy', () => {
    unmountComponentAtNode(domNode);
  });
}

chrome.setRootController('omar', RootController);
