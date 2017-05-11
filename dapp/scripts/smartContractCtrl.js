'use strict';

var app = angular.module('Corporation');

// https://docs.angularjs.org/api/ng/provider/$logProvider
app.config(function ($logProvider) {
        // $logProvider.debugEnabled(false);
        $logProvider.debugEnabled(true);
    }
);

app.controller('smartContractController', [
    '$rootScope',
    '$scope',
    '$window',
    // '$sce',
    '$timeout',
    '$log',
    function metrumCoinLtdSharesCtrl($rootScope,
                                     $scope,
                                     $window, // https://docs.angularjs.org/api/ng/service/$window
                                     // $sce,
                                     $timeout,
                                     $log) {

        $log.debug('metrumCoinLtdSharesCtrl ver. 003 started');
        // --- Alerts:
        $scope.alertDanger = null;  // red
        $scope.alertWarning = null; // yellow
        $scope.alertInfo = null;    // blue
        $scope.alertSuccess = null; // green
        //
        $scope.showMainSection = false;
        //
        $scope.nodeConnected = null; //
        //
        $scope.balanceOf = {}; // to store USER account balances in tokens
        // $scope.allShareholdersArray = [];
        $scope.shareholdersBalances = {};
        $scope.shareholdersBalancesArray = [];
        //
        var catchError = function (error) {
            $scope.alertDanger = error.toString();
            $log.error(error);
        };

        // var startApp = function () {
        //     $log.debug("startApp() started");

        // check connection to node // do we need this now???? 
        // if ($rootScope.web3 && $rootScope.web3.isConnected()) {
        //     $log.log('[smartContractCtrl.js] $rootScope.web3.isConnected(): ' + $rootScope.web3.isConnected());
        //     $scope.mainSectionShow = true;
        //     $scope.showNetworkInfo = true;
        // } else {
        //     $log.error("[smartContractCtrl.js] ethereum node not connected");
        //     $scope.alertDanger = 'You are not connected to Ethereum network.'
        //         + ' Please use Mist browser'
        //         + ' or Google Chrome with MetaMask plugin (see instructions on "Home" tab) ';
        //     return; // TODO: does it really prevents rest of the controller function execution?
        // }

        // check network:
        // https://github.com/ethereum/wiki/wiki/JavaScript-API#web3versionnetwork
        // web3.version.network
        // or async
        // web3.version.getNetwork(callback(error, result){ ... })
        // --- returns String - The network protocol version.
        // $scope.ethereumNetwork = null;
        // web3.version.getNetwork(function (error, result) {
        //         if (result) {
        //             $scope.ethereumNetwork = result;
        //             $log.debug('$scope.ethereumNetwork: ' + $scope.ethereumNetwork);
        //         } else {
        //             $log.error(error);
        //             $scope.alertDanger = error.toString() +
        //                 ' Please use Mist browser or Chrome with MetaMask plugin to open this page, '
        //                 + 'or try to reload this page';
        //         }
        //     }
        // );

        // --- sync! - prevents executing page without connection to network
        try {
            $log.info('Current network ID:' + $rootScope.web3.version.network);
        } catch (error) {
            $log.error(error);
            $scope.alertDanger =
                error.toString()
                + ' No connection to Ethereum node: '
                + 'please use Mist browser or Chrome with MetaMask plugin to open this page, '
                + 'or try to reload this page';
            return; // ---> stops controller (works)
        }

        if ($rootScope.web3 && $rootScope.web3.isConnected()) {

            $scope.showMainSection = true;
            $log.info('$scope.showMainSection: ' + $scope.showMainSection);

            // interface settings:
            $scope.showAllAccounts = true;
            $scope.showAllShareholders = true;
            $scope.showAllEvents = true;
            $scope.showAllProposals = true;
            $scope.showChart = true;
            $scope.proposalID = 0;
            $scope.clientNodeVersion = "";

            // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
            // var contractAddressMainNet = '0x684282178b1d61164febcf9609ca195bef9a33b5';
            var contractAddressMainNet = '0x684282178b1d61164FEbCf9609cA195BeF9A33B5';
            var contractMainNetDeployedOnBlock = 1918776;

            var contractAddressTestNet = '0x47d55ec9E1d5DEb893D3943e6d84011E488b1A37';
            var contractTestNetDeployedOnBlock = 493816;

            var contractDeployedOnBlock = 0; // where to start collecting events

            // Check client/node version
            $rootScope.web3.version.getNode(function (error, result) {
                    if (result) {
                        // The client/node version.
                        // "Mist/v0.9.3/darwin/go1.4.1"
                        $scope.clientNodeVersion = result;
                        $log.info('$scope.clientNodeVersion: ' + $scope.clientNodeVersion);
                    } else {
                        $log.error(error);
                        $scope.alertDanger = error.toString();
                    }
                }
            );

            // check network:
            if ($rootScope.web3.version.network === '1') {
                $scope.contract = Corporation.at(contractAddressMainNet);
                contractDeployedOnBlock = contractMainNetDeployedOnBlock;
                $scope.networkInfo = 'Ethereum MainNet';
                $scope.etherscanLinkPrefix = 'https://etherscan.io';
                $scope.showMainSection = true;
                //
            } else if ($rootScope.web3.version.network === '3') {
                $scope.contract = Corporation.at(contractAddressTestNet);
                contractDeployedOnBlock = contractTestNetDeployedOnBlock;
                $scope.networkInfo = 'Ethereum TestNet Ropsten';
                // $scope.etherscanLinkPrefix = 'https://testnet.etherscan.io';
                $scope.etherscanLinkPrefix = 'https://ropsten.etherscan.io';
            } else if ($rootScope.web3.version.network.length === 13) {
                $scope.contract = Corporation.deployed();
                $scope.testrpc = true;
                $scope.networkInfo = 'TestRPC';
                $scope.etherscanLinkPrefix = '';
            } else {
                $scope.unknownNet = true;
                $scope.networkInfo = 'Unknown network';
                $scope.alertDanger = 'Your network: unknown blockchain(' + $scope.clientNodeVersion + ')';
                $scope.etherscanLinkPrefix = '';
            }

            $log.info("truffle contract: ");
            $log.info($scope.contract);

            $scope.mistDetected = false;
            // detect user accounts:
            if ($rootScope.web3.eth.accounts.length == 0) {
                $scope.alertDanger = 'Accounts not detected';
                $scope.noAccountsDetected = true;
                $log.error('no accounts detected');
                return;
            }


            var createShareholdersBalancesArray = function () { // for the chart

                $log.log('createShareholdersBalancesArray started');
                var shareholdersBalancesArray = [];

                var arr = Object.keys($scope.shareholdersBalances);
                // log:
                $log.debug('$scope.shareholdersBalances:');
                $log.debug($scope.shareholdersBalances);
                $log.log('var arr = Object.keys($scope.shareholdersBalances);');
                $log.log(arr); //

                // for (var key in arr) {  // does not work
                for (var i = 0; i < arr.length; i++) {
                    var key = arr[i];
                    $log.debug('key: ' + key);
                    $log.debug('value: ' + $scope.shareholdersBalances[key]);
                    var next = [key, $scope.shareholdersBalances[key]];
                    $log.log('next:');
                    $log.log(next);
                    // The push() method adds new items to the end of an array, and returns the new length.
                    $log.log(
                        shareholdersBalancesArray.push(next)
                    );
                }
                $scope.shareholdersBalancesArray = shareholdersBalancesArray;
                $scope.$apply();
                $log.info('$scope.shareholdersBalancesArray: ');
                $log.info($scope.shareholdersBalancesArray);
                return shareholdersBalancesArray;
            }; // end of createShareholdersBalancesArray;

            /* ---- Get balance of acc in tokens : */
            $scope.getBalanceOf = function (address) {
                var acc = address.toString();
                $scope.contract.balanceOf.call(acc).then(
                    function (balanceInTokens) {
                        $log.debug('[$scope.getBalanceOf()] balanceInTokens: ' + balanceInTokens);
                        balanceInTokens = balanceInTokens.toNumber();

                        $log.log('[$scope.getBalanceOf] ' + acc + ' balance in tokens: ' + balanceInTokens);

                        // if balanceInTokens > 0 it's a shareholder,
                        // and have to be added to $scope.shareholdersBalances
                        if (balanceInTokens > 0) {
                            $scope.shareholdersBalances[acc] = balanceInTokens;
                            $log.debug('[$scope.getBalanceOf()]$scope.shareholdersBalances:');
                            $log.debug($scope.shareholdersBalances);
                        }
                        // if it's account of current Dapp user,
                        // we store it in $scope.balanceOf in any case, even if balance is 0
                        if ($rootScope.web3.eth.accounts.includes(acc)) {
                            $scope.balanceOf[acc] = balanceInTokens;
                            $log.debug('[$scope.getBalanceOf()] $scope.balanceOf');
                            $log.debug($scope.balanceOf);
                        }
                        $scope.$apply();
                        $scope.drawPieChart(); // refresh chart with new info
                        // return;
                    }
                ).catch(function (error) {
                        $scope.alertDanger = error;
                        $log.error(error);
                        // return;
                    }
                );
            };

            $scope.etherOnAccountOnBlockchain = {}; // to store acc balances in tokens
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
                            $log.log('ether on account: '
                                + currentAccount
                                + ' : '
                                + $scope.etherOnAccountOnBlockchain[currentAccount]
                            );
                        }
                    }
                );
            }; // end of $scope.getEthBalanceOf;

            $scope.refreshBalances = function () {  // both ether and tokens for USER accounts
                $log.debug('refreshBalances() started');
                for (var i = 0; i < $rootScope.web3.eth.accounts.length; i++) { // safe for MetaMusk
                    var acc = $rootScope.web3.eth.accounts[i];
                    $log.debug('[refreshBalances()] acc: ' + acc);
                    // acc tokens
                    $scope.getBalanceOf(acc);
                    // acc ETH
                    $scope.getEthBalanceOf(acc);
                }
            };

            $scope.setDefaultAccount = function (address) {
                $log.debug('setting default account');
                $rootScope.web3.eth.defaultAccount = address;
                // $scope.refreshBalances();
                $log.log('$rootScope.web3.eth.defaultAccount : ' + $rootScope.web3.eth.defaultAccount);
                return $rootScope.web3.eth.defaultAccount;
            };

            // --- for contract info:
            $scope.getTotalSupply = function () {
                $scope.contract.totalSupply.call().then(function (totalSupply) {
                        $scope.totalSupply = totalSupply.toNumber();
                        $scope.$apply(); // <<< needed
                        $log.log('Total supply: ' + $scope.totalSupply);
                    }
                ).catch(function (error) {
                    $scope.alertDanger = error.toString();
                    $log.error(error);
                });
            };

            var getShareholderDataById = function (id) {
                // $scope.contract.activeShareholdersArray.call(id).then( //
                $scope.contract.shareholder.call(id).then(
                    function (address) { // shareholder address

                        if (address != '0x') { // on TestNet and MainNet // < !!! we can count array ---------- !!!!
                            // - index with '0x' - will be array length
                            // than we can check $scope.getBalanceOf(address) and pick up only addresses with
                            // balance > 0 and put them in real activeShareholdersArray ;
                            $scope.activeShareholdersArray[id] = address;
                            $scope.getBalanceOf(address); // <
                        }
                        return null; // to avoid: Warning: a promise was created in a handler but was not returned from it
                    }
                ).catch(function (error) {
                        $scope.alertDanger = error.toString();
                        $log.error(error);
                        return null; // to avoid:
                        // Warning: a promise was created in a handler but was not returned from it
                    }
                );
            };
            $scope.refreshShareholdersBalancesArray = function () { // collects SHAREHOLDERS acc balances

                $log.debug('$scope.refreshShareholdersBalancesArray started');
                $scope.shareholdersBalances = {}; // set empty
                $scope.activeShareholdersArray = []; // set empty
                var activeShareholdersArrayLength = 50; // <<<<<<<<<<<<<<<<<<<<<<<<< set manually (dirty hack) !!!!!

                for (var i = 0; i < activeShareholdersArrayLength; i++) {
                    getShareholderDataById(i);
                }
            }; // end of refreshShareholdersBalancesArray();

            /* ----------- Draw Pie Chart */
            // https://google-developers.appspot.com/chart/interactive/docs/gallery/piechart
            $scope.drawPieChart = function () {

                $log.debug('drawPieChart: ');

                // $rootScope.progressbar.start(); // <<<<<<<<<<<

                // $scope.refreshShareholdersBalancesArray(); //

                // check if google.charts is avaiable:
                if (typeof google == 'undefined' || typeof google.charts == 'undefined') {
                    $log.error('google.charts not loaded');
                    return;
                }

                google.charts.load('current', {'packages': ['corechart']});
                google.charts.setOnLoadCallback(drawChart);

                function drawChart() { // -> 'Refresh data' button

                    $log.debug('drawChart started');

                    var shareholdersBalancesArrayForChart = createShareholdersBalancesArray();
                    $log.debug('shareholdersBalancesArrayForChart: ');
                    $log.debug(shareholdersBalancesArrayForChart);
                    var dataArray = [['Shareholder Account', 'shares']].concat(
                        shareholdersBalancesArrayForChart
                    );
                    $log.info('dataArray from drawChart(): ');
                    $log.info(dataArray);

                    var data = google.visualization.arrayToDataTable(
                        dataArray
                    );

                    var options = {title: 'Shares'};
                    var chart = new google.visualization.PieChart(document.getElementById('piechart'));
                    chart.draw(data, options);
                }

                // $timeout($rootScope.progressbar.complete(), 1000);
                // $rootScope.progressbar.complete(); // <<< ---
                // angular.element(window).triggerHandler('resize'); // ?
            }; // end of $scope.drawPieChart();
            // --- RUN:
            // >>>> RUN: set default account and refresh balances:
            if ((!$rootScope.web3.eth.defaultAccount) && web3.eth.accounts.length > 0) {
                $scope.setDefaultAccount(web3.eth.accounts[0]);
            }
            $scope.refreshBalances();
            $scope.getTotalSupply();
            $scope.refreshShareholdersBalancesArray(); //
            // ----------------------------------------------------
            // $scope.drawPieChart(); // included in =>  => $scope.refreshShareholdersBalancesArray

            /* ######################## CONTRACT FUNCTIONS: */
            $scope.transactions = [];
            //
            $scope.transfer = function () {
                $rootScope.progressbar.start(); // <<<<<<<<<<<
                $rootScope.progressbar.set(35);
                var txParameters = {};
                txParameters.from = $rootScope.web3.eth.defaultAccount;
                //noinspection JSUnresolvedFunction
                $scope.contract.transfer(
                    $scope.transferTo.toString(),
                    parseInt($scope.transferValue),
                    txParameters
                )
                    .then(function (tx_id) {
                            $scope.drawPieChart(); // refreshes all token balances;
                            $scope.lastTxId = tx_id;
                            $scope.transactions.push(tx_id);
                            $scope.$apply();
                            $timeout($rootScope.progressbar.complete(), 1000);
                        }
                    ).catch(function (error) {
                    $scope.alertDanger = error.toString();
                    $log.error(error);
                });

            }; // end of $scope.transfer()

            /* ------------- VOTING: */
            $scope.proposals = [];
            var getProposalTextById = function (id) { // proposal ID
                $scope.contract.proposalText.call(id).then(
                    function (proposalText) {
                        if (proposalText != '0x') {
                            if ($scope.proposals[id] === undefined) {
                                $scope.proposals[id] = {};
                            }
                            $scope.proposals[id]['id'] = id;
                            $scope.proposals[id]['description'] = proposalText;
                            $scope.$apply();
                            getProposalDeadlineById(id); // only if proposalText != '0x'
                            getProposalResultsById(id); // only if proposalText != '0x'
                        }
                    }
                ).catch(function (error) {
                        $scope.alertDanger = error.toString();
                        $log.error(error);
                    }
                );
            };
            var getProposalDeadlineById = function (id) { // proposal ID
                $scope.contract.deadline.call(id).then(
                    function (unix_timestamp) {
                        // unix_timestamp = unix_timestamp.toNumber();
                        if ($scope.proposals[id] === undefined) {
                            $scope.proposals[id] = {};
                        }
                        $scope.proposals[id]['deadline'] = new Date(unix_timestamp * 1000);
                        $scope.$apply();
                    }
                ).catch(function (error) {
                    $scope.alertDanger = error.toString();
                    $log.error(error);
                });
            };
            var getProposalResultsById = function (id) { // proposal ID
                $scope.contract.results.call(id).then(
                    function (results) {
                        results = results.toNumber();

                        if ($scope.proposals[id] === undefined) {
                            $scope.proposals[id] = {};
                        }
                        // if (results !== null) {
                        //     results = results.toNumber();
                        //     // $scope.proposals[id]['finished'] = true; //
                        // }
                        $scope.proposals[id]['results'] = results;
                        $scope.$apply();
                    }
                ).catch(function (error) {
                    $scope.alertDanger = error.toString();
                    $log.error(error);
                });
            };

            $scope.getAllProposals = function () {
                $log.debug('$scope.getAllProposals() started');
                var proposalTextArrayLength = 100; // -- another temporary hack, see above how to count an array !!!
                // $scope.proposalTextArrayLength = proposalTextArrayLength;
                // $scope.$apply(); // <<< not here
                // $log.debug('$scope.proposalTextArrayLength: ' + $scope.proposalTextArrayLength);
                // for (var i = 0; i < $scope.proposalTextArrayLength; i++) {
                for (var i = 0; i < proposalTextArrayLength; i++) {
                    getProposalTextById(i);
                    // getProposalDeadlineById(i); // moved to getProposalTextById()
                    // getProposalResultsById(i);  // moved to getProposalTextById()
                }
            };

            // >>>>>>>>> RUN:
            $scope.getAllProposals();
            // --------------

            $scope.makeNewProposal = function (newProposalDescription, newDebatingPeriodInMinutes) {
                $rootScope.progressbar.start(); // <<<<<<<<<<<
                $rootScope.progressbar.set(35);
                var txParameters = {};
                txParameters.from = $rootScope.web3.eth.defaultAccount;

                if (!$scope.activeShareholdersArray.includes(txParameters.from)) {
                    var errorMessage = '[Make new proposal] You have to be a shareholder to make proposals';
                    $log.error(errorMessage);
                    $scope.alertDanger = errorMessage;
                    return;
                }

                $scope.contract.makeNewProposal(
                    newProposalDescription,
                    parseInt(newDebatingPeriodInMinutes),
                    txParameters
                )
                    .then(function (tx_id) {
                            $scope.getAllProposals();
                            $scope.lastTxId = tx_id;
                            $scope.transactions.push(tx_id);
                            $scope.$apply();
                            $timeout($rootScope.progressbar.complete(), 1000);
                        }
                    ).catch(function (error) {
                        $scope.alertDanger = '[Make new proposal]' + error.toString();
                        $log.error(error);
                        $timeout($rootScope.progressbar.complete(), 1000);
                        return error;
                    }
                );
            }; // end of $scope.makeNewProposal()

            //
            $scope.voteForProposal = function (proposalID) {
                $rootScope.progressbar.start(); // <<<<<<<<<<<
                $rootScope.progressbar.set(35);
                var txParameters = {};
                txParameters.from = $rootScope.web3.eth.defaultAccount;
                if (!$scope.activeShareholdersArray.includes(txParameters.from)) {
                    var errorMessage = '[Vote for proposal] You have to be a shareholder to vote for proposals';
                    $log.error(errorMessage);
                    $scope.alertDanger = errorMessage;
                    return;
                }
                $scope.contract.voteForProposal(
                    parseInt(proposalID),
                    txParameters
                ).then(function (tx_id) {
                        $scope.getAllProposals();
                        $scope.lastTxId = tx_id;
                        $scope.transactions.push(tx_id);
                        $scope.$apply();
                        $timeout($rootScope.progressbar.complete(), 1000);
                        return tx_id;
                    }
                ).catch(function (error) {
                        $scope.alertDanger = '[Vote for proposal]' + error.toString();
                        $log.error(error);
                        $timeout($rootScope.progressbar.complete(), 1000);
                        return error;
                    }
                );
            }; // end of $scope.voteForProposal()

            //
            $scope.countVotes = function (proposalID) {
                $rootScope.progressbar.start(); // <<<<<<<<<<<
                $rootScope.progressbar.set(35);
                var txParameters = {};
                txParameters.from = $rootScope.web3.eth.defaultAccount;
                $scope.contract.countVotes(
                    parseInt(proposalID),
                    txParameters
                ).then(function (tx_id) {
                        $scope.getAllProposals();
                        $scope.lastTxId = tx_id;
                        $scope.transactions.push(tx_id);
                        $scope.$apply();
                        $timeout($rootScope.progressbar.complete(), 1000);
                    }
                ).catch(function (error) {
                        $scope.alertDanger = '[Count Votes]' + error.toString();
                        $log.error(error);
                        $timeout($rootScope.progressbar.complete(), 1000);
                        return error;
                    }
                );
            }; // end of $scope.countVotes()

            /* ------------- EVENTS: */
            // for MetaMask see:
            // https://github.com/MetaMask/metamask-plugin/issues/503
            $scope.events = [];
            var events = $scope.contract.allEvents(
                {fromBlock: contractDeployedOnBlock, toBlock: 'latest'}
            );
            $log.debug('events:');
            $log.debug(events);
            events.watch(
                function (error, result) {
                    if (error) {
                        $log.error(error);
                    } else if (result) {
                        $scope.events.push(result);
                        if (result.event == 'ProposalAdded') {
                            $scope.proposals[result.args.proposalID.toNumber()]['initiator']
                                = result.args.initiator;
                        } else if (result.event == 'VotingFinished') {
                            $scope.proposals[result.args.proposalID.toNumber()]['votes']
                                = result.args.votes.toNumber();
                            $scope.proposals[result.args.proposalID.toNumber()]['finished']
                                = true;
                        }
                        $scope.$apply(); // <<< needed here!!!
                        $log.info('events.watch:');
                        $log.log(result);
                    }
                }
            );

        } // end of if ($rootScope.web3 && $rootScope.web3.isConnected())

        // }; // end of startApp()


    } // end of function smartContractCtrl

]);
