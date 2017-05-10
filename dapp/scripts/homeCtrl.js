'use strict';

var app = angular.module('Corporation');

//noinspection JSUnusedGlobalSymbols,
app.controller('HomeController', [
        '$scope',
        // '$rootScope',
        // '$window',
        '$sce',
        '$log',
        function homeCtrl($scope,
                          // $rootScope,
                          // $window, // https://docs.angularjs.org/api/ng/service/$window
                          $sce,
                          $log) {

            $log.debug('HomeController started');
            // --- Alerts:
            $scope.alertSuccess = null;
            $scope.alertInfo = null;
            $scope.alertWarning = null;
            $scope.alertDanger = null;

        } // end of function HomeCtrl
    ]
);

