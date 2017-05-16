'use strict';

var app = angular.module('Corporation');

// https://docs.angularjs.org/api/ng/provider/$logProvider
app.config(function ($logProvider) {
        // $logProvider.debugEnabled(false);
        $logProvider.debugEnabled(true);
    }
);

app.controller('IcoController', [
    '$rootScope',
    '$scope',
    '$window',
    // '$sce',
    '$timeout',
    '$log',
    function IcoCtrl($rootScope,
                     $scope,
                     $window, // https://docs.angularjs.org/api/ng/service/$window
                     // $sce,
                     $timeout,
                     $log) {

        $log.debug('IcoCtrl ver. 001 started');
        // --- Alerts:
        $scope.alertDanger = null;  // red
        $scope.alertWarning = null; // yellow
        $scope.alertInfo = null;    // blue
        $scope.alertSuccess = null; // green
        //
        $scope.showMainSection = false;
        $scope.notConnected = null;
        //

        // check connection to node
        if ($rootScope.web3 && $rootScope.web3.isConnected()) {
            $log.log('[IcoCtrl.js] $rootScope.web3.isConnected(): true');
            $scope.mainSectionShow = true;
            $scope.showNetworkInfo = true;
        } else {
            $log.error("[IcoCtrl.js] ethereum node not connected");
            $scope.alertDanger = 'You are not connected to Ethereum network.'
                + ' Please use Mist browser'
                + " or Google Chrome with MetaMask plugin (see instructions on the 'Start' tab)";
            $scope.notConnected = true;
            return; //
        }

        // interface settings:
        $scope.showMainSection = true;
        $scope.showAllAccounts = true;
        $scope.showAllEvents = true;

        // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
        // --- Tokens Contract: 
        var tokenContractAddressMainNet = '0x684282178b1d61164FEbCf9609cA195BeF9A33B5';
        var tokenContractMainNetDeployedOnBlock = 1918776;
        var tokenContractAddressTestNet = '0x47d55ec9E1d5DEb893D3943e6d84011E488b1A37';
        var tokencontractTestNetDeployedOnBlock = 493816;
        // --- ICO Contract: 
        var icoContractAddressMainNet = '0x24a57F642948e36e8f0ce0a4B3b940Cbfe14bd4C';
        var icoContractMainNetDeployedOnBlock = 3713407;
        var icoContractAddressTestNet = '0x505b451539F0A3d2c86916E1312796fe1bb2b130'; // Ropsten
        var icoContractTestNetDeployedOnBlock = 939068;

        var icoContractDeployedOnBlock = 0; // where to start collecting events

        // check network:
        // ( web3.version.network - works (sync) in MetaMask
        // https://github.com/MetaMask/faq/blob/master/DEVELOPERS.md#dizzy-all-async---think-of-metamask-as-a-light-client
        if ($rootScope.web3.version.network === '1') {
            // change in production: --------------------------------------------------------------------------------!!!
            $scope.networkInfo = 'Ethereum MainNet';
            $scope.etherscanLinkPrefix = 'https://etherscan.io';
            $scope.tokenContract = Corporation.at(tokenContractAddressMainNet);
            $scope.icoContract = ICO.at(icoContractAddressMainNet);
            icoContractDeployedOnBlock = icoContractMainNetDeployedOnBlock;
        } else if ($rootScope.web3.version.network === '3') {
            $scope.tokenContract = Corporation.at(tokenContractAddressTestNet);
            $scope.icoContract = ICO.at(icoContractAddressTestNet);
            icoContractDeployedOnBlock = icoContractTestNetDeployedOnBlock;
            $scope.networkInfo = 'Ethereum TestNet Ropsten';
            $scope.etherscanLinkPrefix = 'https://ropsten.etherscan.io';
        } else if ($rootScope.web3.version.network.length === 13) {
            $scope.tokenContract = Corporation.deployed();
            $scope.icoContract.deployed();
            $scope.testrpc = true;
            $scope.networkInfo = 'TestRPC';
            $scope.etherscanLinkPrefix = '';
        } else {
            $scope.unknownNet = true;
            $scope.networkInfo = 'Unknown network';
            $scope.alertDanger = 'Your network: unknown blockchain(' + $rootScope.clientNodeVersion + ')';
            $scope.etherscanLinkPrefix = '';
            return; // ----------------------------------------------------------------------------------------------!!!
        }

        $log.debug("truffle contracts: ");
        $log.debug($scope.tokenContract);
        $log.debug($scope.icoContract);

        // detect user accounts:
        if ($rootScope.web3.eth.accounts.length == 0) {
            $scope.alertDanger = 'Accounts not detected';
            $scope.noAccountsDetected = true;
            $log.error('no accounts detected');
            return;
        }

        $scope.etherOnAccountOnBlockchain = {}; // to store user accounts balances in ETH
        $scope.getEthBalanceOf = function (address) {
            $log.debug('getEthBalanceOf() started for address: ' + address);
            var currentAccount = address;
            $rootScope.web3.eth.getBalance(currentAccount, function (error, result) {
                    if (result) {
                        $scope.etherOnAccountOnBlockchain[currentAccount] =
                            $rootScope.web3.fromWei(
                                result.toNumber(), 'ether'
                            );
                        $scope.$apply(); //
                        $log.debug('ether on account: '
                            + currentAccount
                            + ' : '
                            + $scope.etherOnAccountOnBlockchain[currentAccount]
                        );
                    } else {
                        $log.debug('$scope.getEthBalanceOf Error:');
                        $log.error(error);
                    }
                }
            );
        }; // end of $scope.getEthBalanceOf;

        /* ---- Get balance of acc in tokens : */
        // $scope.balanceOf = [];
        $scope.balanceOf = {};
        $scope.refreshingBalanceOf = {};
        $scope.getBalanceOf = function (address) {
            var acc = address.toString();
            $log.debug('$scope.getBalanceOf() for ' + acc + ' started');
            // $scope.balanceOf[acc] = null;
            $scope.refreshingBalanceOf[acc] = true;
            $scope.tokenContract.balanceOf.call(acc).then(
                function (balanceInTokens) {
                    balanceInTokens = balanceInTokens.toNumber();
                    $scope.balanceOf[acc] = balanceInTokens;
                    $log.debug('[$scope.getBalanceOf()] $scope.balanceOf');
                    $log.debug($scope.balanceOf);
                    $scope.refreshingBalanceOf[acc] = false;
                    $scope.$apply();
                    // $scope.drawPieChart(); // refresh chart with new info
                }
            ).catch(function (error) {
                    $scope.alertDanger = error;
                    $log.error(error);
                    $scope.refreshingBalanceOf[acc] = false;
                }
            );
        };

        $scope.refreshBalances = function () {  // both ether and tokens for USER accounts            
            $log.debug('refreshBalances() started');
            // get tokens and ETH avaiable in this contract:
            $scope.getBalanceOf($scope.icoContract.address);
            $scope.getEthBalanceOf($scope.icoContract.address);
            // get user account balances: 
            for (var i = 0; i < $rootScope.web3.eth.accounts.length; i++) { // safe for MetaMusk
                var acc = $rootScope.web3.eth.accounts[i];
                $log.debug('[refreshBalances()] acc: ' + acc);
                // acc tokens
                $scope.getBalanceOf(acc);
                // acc ETH
                $scope.getEthBalanceOf(acc);
            }
        };
        // >>> RUN: 
        $scope.refreshBalances();

        $scope.setDefaultAccount = function (address) {
            $log.debug('setting default account');
            $rootScope.web3.eth.defaultAccount = address;
            // $scope.refreshBalances();
            $log.log('$rootScope.web3.eth.defaultAccount : ' + $rootScope.web3.eth.defaultAccount);
            return $rootScope.web3.eth.defaultAccount;
        };
        // >>>>>>>>>>>>> RUN: set default account
        if ((!$rootScope.web3.eth.defaultAccount) && web3.eth.accounts.length > 0) {
            $scope.setDefaultAccount(web3.eth.accounts[0]);
        }

        /* ######################## CONTRACT FUNCTIONS: */
        $scope.transactions = [];
        //
        $scope.priceToBuyInFinney = 0;
        $scope.getPriceToBuy = function () {
            $log.debug('$scope.priceToBuy() started');
            $scope.refreshingPriceToBuyInFinney = true;
            $scope.icoContract.priceToBuyInFinney.call().then(function (priceToBuyInFinney) {
                    $scope.priceToBuyInFinney = priceToBuyInFinney.toNumber(); //
                    $scope.refreshingPriceToBuyInFinney = false;
                    $scope.$apply(); // <<< needed
                    $log.info('priceToBuyInFinney: ' + $scope.priceToBuyInFinney);
                }
            ).catch(function (error) {
                    $scope.alertDanger = error.toString();
                    $log.error(error);
                    $scope.refreshingPriceToBuyInFinney = false;
                    $scope.$apply(); // <<< needed
                }
            );
        }; // end of  $scope.getPriceToBuy()
        // >>>> RUN: 
        $scope.getPriceToBuy();

        $scope.buyTokens = function () {
            if ($scope.buyTokensTxInProgress) {
                return; // if previous tx not finished
            }
            $scope.buyTokensTxInProgress = true;
            $scope.buyTokensError = null;
            $scope.byuTocensSuccess = null;
            $log.debug('$scope.buyTokens() started');
            var quantityToBuy = parseInt($scope.quantityToBuy);
            if (quantityToBuy == null
                || isNaN(quantityToBuy)
                || quantityToBuy <= 0
                || quantityToBuy > $scope.balanceOf[$scope.icoContract.address]
            ) {
                $scope.buyTokensError = "Entered quantity to buy is not correct";
                $scope.buyTokensTxInProgress = false;
                return;
            }
            var txParameters = {};
            txParameters.from = $rootScope.web3.eth.defaultAccount;
            txParameters.value = web3.toWei(quantityToBuy * $scope.priceToBuyInFinney, 'finney');
            $scope.icoContract.buyTokens(
                quantityToBuy,
                $scope.priceToBuyInFinney,
                txParameters
            )
                .then(function (tx_id) {
                        $scope.lastTxId = tx_id;
                        $scope.transactions.push(tx_id);
                        $scope.refreshBalances();
                        $scope.buyTokensSuccessTx = tx_id;
                        $scope.buyTokensTxInProgress = false;
                        $scope.buyTokensSuccess = true;
                        $scope.$apply(); //
                    }
                ).catch(function (error) {
                    $scope.buyTokensError = error.toString();
                    // $scope.alertDanger = error.toString();
                    $log.debug('$scope.buyTokens Error:');
                    $log.error(error);
                    $scope.buyTokensTxInProgress = false;
                    $scope.$apply();
                }
            );
        }; // end of $scope.buyTokens()

        /* ---------------------------------- EVENTS: */
        $scope.events = [];
        $rootScope.web3.eth.getBlock('latest', function (error, result) {
            if (error) {
                $log.debug('$rootScope.web3.getBlock Error:');
                $log.error(error);
            } else if (result) {
                // returns:
                // Object - The block object:
                // https://github.com/ethereum/wiki/wiki/JavaScript-API#returns-36
                $log.debug('$rootScope.web3.getBlock result:');
                $log.debug(result);
                $scope.lastBlock = result; //

                // for MetaMask see:
                // https://github.com/MetaMask/metamask-plugin/issues/503
                /* ---- LAST events */
                $scope.eventsStartingFromBlock = $scope.lastBlock.number - 300000;
                // temporary hack -------------------------------------------------------------- !!!
                if ($rootScope.metaMask && $scope.mainNet) {
                    $scope.eventsStartingFromBlock = $scope.lastBlock.number - 300000;
                } else {
                    $scope.eventsStartingFromBlock = icoContractDeployedOnBlock;
                }
                var events = $scope.icoContract.allEvents(
                    {
                        fromBlock: $scope.eventsStartingFromBlock,
                        toBlock: 'latest'
                    }
                );
                events.watch(
                    // possible errors:
                    // "Error: Gateway timeout. The request took too long to process.
                    // This can happen when querying logs over too wide a block range."
                    //
                    function (error, result) {
                        if (error) {
                            $log.debug('events.watch error:');
                            $log.error(error);
                            $scope.eventsError = error.toString();
                            $scope.$apply(); // < ?
                        } else if (result) {
                            $scope.events.push(result);
                            $scope.$apply(); // <<< needed here!!!
                            $log.info('events.watch result:');
                            $log.log(result);
                        }
                    }
                ); // end of events events.watch

            } // $rootScope.web3.eth.getBlock - if result

        }); // end of $rootScope.web3.eth.getBlock

    } // end of function smartContractCtrl

]);
