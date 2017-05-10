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

            $log.info('app.js ver. 003 started');

            $rootScope.progressbar = ngProgressFactory.createInstance();
            $rootScope.progressbar.setHeight('5px'); // any valid CSS value Eg '10px', '1em' or '1%'
            $rootScope.progressbar.setColor('blue');

            //    ------------------

            // First we need to create a web3 instance, setting a provider.
            // To make sure you don't overwrite the already set provider when in mist,
            // check first if the web3 is available:
            if (typeof $window.web3 !== 'undefined') {
                // $rootScope.web3 = $window.web3;
                // Use Mist/MetaMask's provider
                // see:
                // https://github.com/MetaMask/faq/blob/master/DEVELOPERS.md#partly_sunny-web3---ethereum-browser-environment-check
                $rootScope.web3 = new Web3($window.web3.currentProvider);
            } else {
                // set the provider you want from Web3.providers
                try {
                    $rootScope.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
                } catch (error) {
                    $log.error(error);
                    // return;
                }
            }

            // check connection to node
            if ($rootScope.web3 && $rootScope.web3.isConnected()) {
                // $log.log('web3.version.node: ' + $rootScope.web3.version.node); // << error in MetaMask
                $log.log('web3.version.api: ' + $rootScope.web3.version.api); // works in MetaMask

            } else {
                $log.error("[app.js] ethereum node not connected");
            }


        } // end: app.run
    ]
);
