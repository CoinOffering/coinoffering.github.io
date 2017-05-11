"use strict";

var app = angular.module("Corporation", [
    'ui.router', // https://ui-router.github.io/ng1/
    'ngProgress', // https://github.com/VictorBjelkholm/ngProgress
    'yaru22.md'  // https://github.com/yaru22/angular-md
]);

app.config(function ($stateProvider, // from ui.router
                     $urlRouterProvider, //
                     $locationProvider,
                     $sceDelegateProvider) {

    $urlRouterProvider.otherwise("/");

    $stateProvider
        .state('home', {
                url: '/',
                controller: 'HomeController',
                templateUrl: 'views/home.html'
            }
        )
        .state('smartContract', {
                url: '/smart-contract',
                controller: 'smartContractController',
                templateUrl: 'views/smartContract.html'
            }
        );

    // see:
    // http://stackoverflow.com/a/41273403/1697878
    // this resolves %2F instead of / in urls problem in AngularJS 1.6.1
    $locationProvider.hashPrefix('');

    $sceDelegateProvider.resourceUrlWhitelist([
            'self' // , // Allow same origin resource loads
            // 'https://raw.githubusercontent.com/CoinOffering/coinoffering.github.io/master/dapp/views/home.content.en.md'
        ]
    );

});

app.run(['$rootScope',
        '$window',
        // '$sce',
        'ngProgressFactory',
        '$log',
        function ($rootScope,
                  $window, //
                  // $sce, //
                  ngProgressFactory,
                  $log) {

            $log.info('app.js ver. 004 started');

            $rootScope.progressbar = ngProgressFactory.createInstance();
            $rootScope.progressbar.setHeight('5px'); // any valid CSS value Eg '10px', '1em' or '1%'
            $rootScope.progressbar.setColor('blue');

            //    ------------------

            // Checking if Web3 has been injected by the browser (Mist/MetaMask)
            if (typeof $window.web3 !== 'undefined') {
                // Use Mist/MetaMask's provider
                $rootScope.web3 = new Web3($window.web3.currentProvider);                //
                $log.debug('[app.js] web3 object presented by provider::');
                $log.debug($rootScope.web3.currentProvider);
            } else {
                $log.debug('No web3 provided (not Mist, not MetaMask');
                // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
                $rootScope.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
            }

            // Check client/node version
            $rootScope.clientNodeVersion = "";
            $rootScope.mist = null;
            $rootScope.metaMask = null;
            $rootScope.web3.version.getNode(function (error, result) {
                    if (result) {
                        // The client/node version.
                        // "Mist/v0.9.3/darwin/go1.4.1"
                        $rootScope.clientNodeVersion = result;
                        $log.info('$rootScope.clientNodeVersion: ' + $rootScope.clientNodeVersion);

                        if ($rootScope.clientNodeVersion.indexOf('MetaMask') !== -1) {
                            $rootScope.metaMask = true;
                        } else if (typeof $window.mist !== 'undefined') {
                            $rootScope.mist = $window.mist;
                        } else {
                            $log.debug('Unknown client or browser');
                        }

                    } else {
                        $log.error(error);
                    }
                }
            );

        } // end: app.run
    ]
);
