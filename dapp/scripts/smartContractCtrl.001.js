'use strict';

var app = angular.module('Corporation');

//noinspection JSUnusedGlobalSymbols
app.controller('smartContractController', [
        '$rootScope',
        '$scope',
        // '$rootScope',
        // '$window',
        // '$sce',
        '$timeout',
        '$log',
        function smartContractCtrl($rootScope,
                                   $scope,
                                   // $window, // https://docs.angularjs.org/api/ng/service/$window
                                   // $sce,
                                   $timeout,
                                   $log) {

            $log.debug('smartContractController started');
            // --- Alerts:
            $scope.alertSuccess = null;
            $scope.alertInfo = null;
            $scope.alertWarning = null;
            $scope.alertDanger = null;

            // prevent using Dapp not from Mist
            // see: https://github.com/ethereum/mist/blob/develop/MISTAPI.md 
            $scope.mistDetected = false;
            if (typeof mist == 'undefined') {
                var errorMessage = 'Please use Mist browser to open this page';
                $log.error(errorMessage);
                $scope.alertDanger = errorMessage;
                return;
            } else {
                $scope.mistDetected = true;
            }

            // First we need to create a web3 instance, setting a provider.
            // To make sure you don't overwrite the already set provider when in mist,
            // check first if the web3 is available:
            if (typeof web3 !== 'undefined') {
                $scope.web3 = web3;
            } else {
                // set the provider you want from Web3.providers
                try {
                    $scope.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
                } catch (error) {
                    $log.error(error);
                    return;
                }
            }

            $log.info('web3:');
            $log.log($scope.web3);
            $log.log('web3.version.api: ' + $scope.web3.version.api);
            $log.log('web3.version.node: ' + $scope.web3.version.node);

            // check network:
            try {
                $log.info('Current network ID:' + $scope.web3.version.network);
            } catch (error) {
                $scope.connectionError = error.toString();
                $scope.alertDanger = $scope.connectionError +
                    ' Please use Mist browser to open this page';
                return;
            }

            while (!$scope.web3.version.network) {
                $log.error("Ethereum node not detected");
                $scope.alertDanger("Ethereum node not detected");
            }

            // interface settings:
            $scope.showAllAccounts = true;
            $scope.showAllShareholders = true;
            $scope.showAllEvents = true;
            $scope.showAllProposals = true;
            $scope.showChart = true;
            $scope.proposalID = 0;

            var contractAddressMainNet = '0x684282178b1d61164febcf9609ca195bef9a33b5';
            var contractAddressTestNet = '0x47d55ec9E1d5DEb893D3943e6d84011E488b1A37';

            if ($scope.web3.version.network === '1') {
                $scope.contract = Corporation.at(contractAddressMainNet);
                $scope.mainNet = true;
                $scope.alertInfo = 'Your network: Ethereum MainNet (' + $scope.web3.version.node + ')';
                $scope.etherscanLinkPrefix = 'https://etherscan.io';
            } else if ($scope.web3.version.network === '3') {
                $scope.contract = Corporation.at(contractAddressTestNet);
                $scope.testNet = true;
                $scope.alertInfo = 'Your network: Ethereum TestNet (' + $scope.web3.version.node + ')';
                $scope.etherscanLinkPrefix = 'https://testnet.etherscan.io';
            } else if ($scope.web3.version.network.length === 13) {
                $scope.contract = Corporation.deployed();
                $scope.testrpc = true;
                $scope.alertInfo = 'Your network: TestRPC (' + $scope.web3.version.node + ')';
                $scope.etherscanLinkPrefix = '';
            } else {
                $scope.unknownNet = true;
                $scope.alertInfo = 'Your network: unknown private blockchain(' + $scope.web3.version.node + ')';
                $scope.etherscanLinkPrefix = '';
            }

            // -------- make contract instances:
            // $log.debug('Truffle Contract ' + $scope.contract.address + ' :');
            // $log.log($scope.contract.constructor.name); // 'Contract'

            // see:
            // https://github.com/ethereum/wiki/wiki/JavaScript-API#web3ethcontract
            // -- can be used for syncronous calls
            var web3Contract = $scope.web3.eth.contract(
                $scope.contract.contract.abi // abiArray
            ).at(
                $scope.contract.address
            );
            // $log.debug('Web3 ContractInstance ' + web3Contract.address + ' :');
            // $log.log(web3Contract.constructor.name); // 'h' - why? because of minified version?
            // $log.log(web3Contract);
            //

            // detect user accounts:
            if ($scope.web3.eth.accounts.length == 0) { //
                if (typeof mist !== 'undefined') {
                    $scope.alertDanger = 'Accounts not detected. ' +
                        'Please, click on the "connect" in the upper right corner of Mist,' +
                        ' and authorize one or more accounts to work with this smart contract';
                } else {
                    $scope.alertDanger = 'Accounts not detected';
                }
                $scope.noAccountsDetected = true;
                $log.error('no accounts detected');
                return;
            }

            $scope.balanceOf = {}; // to store acc balances in tokens
            $scope.getBalanceOf = function (address) {
                $scope.contract.balanceOf.call(address).then(
                    function (balanceInTokens) {
                        $scope.balanceOf[address] = balanceInTokens.toNumber();
                        $scope.$apply();
                        // $log.info('$scope.getBalanceOf : ' + address);
                        // $log.log($scope.balanceOf[address]);
                        return $scope.balanceOf[address];
                    }
                ).catch(function (error) {
                        $scope.alertDanger = error.toString();
                        $log.error(error);
                        return error;
                    }
                );
            };

            $scope.etherOnAccountOnBlockchain = {}; // ether on blockchain;
            $scope.refreshBalances = function () { // both ether and tokens on acc

                $log.debug('refreshing ETH and token balances:');
                $rootScope.progressbar.start(); // <<<<<<<<<<<

                for (var i = 0; i < web3.eth.accounts.length; i++) {
                    var acc = web3.eth.accounts[i];
                    // $log.info(acc);
                    //noinspection JSUnresolvedFunction
                    $scope.etherOnAccountOnBlockchain[acc] =
                        web3.fromWei(web3.eth.getBalance(acc).toNumber(), 'ether');
                    // $log.log('ether on account: ' + $scope.etherOnAccountOnBlockchain[acc]);
                    // acc tokens

                    // $scope.getBalanceOf(acc);
                    $scope.balanceOf[acc] = web3Contract.balanceOf.call(acc).toNumber();
                }
                $log.info('$scope.etherOnAccountOnBlockchain');
                $log.log($scope.etherOnAccountOnBlockchain);
                $log.info('$scope.balanceOf');
                $log.log($scope.balanceOf);
                $timeout($rootScope.progressbar.complete(), 1000);
            };

            $scope.setDefaultAccount = function (address) {
                $log.debug('setting default account');
                $scope.web3.eth.defaultAccount = address;
                // $scope.refreshBalances();
                $log.log('$scope.web3.eth.defaultAccount : ' + $scope.web3.eth.defaultAccount);
                return $scope.web3.eth.defaultAccount;
            };

            // -- RUN: set default account and refresh balances: 
            if (!$scope.web3.eth.defaultAccount && web3.eth.accounts.length > 0) {
                $scope.setDefaultAccount(web3.eth.accounts[0]);
            }
            $scope.refreshBalances();

            // --- for contract info: 
            $scope.getTotalSupply = function () {
                $scope.contract.totalSupply.call().then(function (totalSupply) {
                        $scope.totalSupply = totalSupply.toNumber();
                        $scope.$apply(); // <<< needed
                        $log.debug('Total supply');
                        $log.log($scope.totalSupply);
                        return $scope.totalSupply; //
                    }
                ).catch(function (error) {
                        $scope.alertDanger = error.toString();
                        $log.error(error);
                        return error;
                    }
                );
            };
            // --- RUN:
            $scope.getTotalSupply();

            $scope.allShareholdersArray = [];
            $scope.getAllShareholdersArray = function () {
                var shareholderId = 0;
                var address;
                while (true) { //
                    try {
                        address = web3Contract.shareholder.call(shareholderId);
                        if (address != '0x') { // on TestNet and MainNet
                            $scope.allShareholdersArray[shareholderId] = address;
                        } else {
                            break;
                        }
                        shareholderId++;
                    } catch (error) {  // on TestRPC
                        $log.error(error);
                        break;
                    }
                }
                // $scope.$apply(); // NOT HERE
                $log.debug('getAllShareholders');
                $log.log($scope.allShareholdersArray);
            }; // end of getAllShareholders();
            // ---- RUN:
            // $scope.getAllShareholdersArray();

            $scope.refreshShareholdersBalancesArray = function () {

                $scope.getAllShareholdersArray();

                $scope.shareholdersBalancesArray = []; // set empty
                for (var i = 0; i < $scope.allShareholdersArray.length; i++) {

                    var address = $scope.allShareholdersArray[i];
                    var bal;

                    try {
                        bal = web3Contract.balanceOf.call(address);
                    } catch (error) {
                        $log.error(error);
                        return;
                    }
                    if (bal > 0) {
                        $scope.shareholdersBalancesArray.push([address, bal.toNumber()]);
                    }
                }
                // $scope.$apply(); // NOT HERE
                $log.debug('$scope.getShareholdersBalancesArray(): ');
                $log.log($scope.shareholdersBalancesArray);
            };
            // ---- RUN:
            // $scope.refreshShareholdersBalancesArray();

            // draw pie chart
            // https://google-developers.appspot.com/chart/interactive/docs/gallery/piechart
            $scope.drawPieChart = function () {

                $log.debug('drawPieChart: ');

                $rootScope.progressbar.start(); // <<<<<<<<<<<

                $scope.refreshShareholdersBalancesArray();

                // check if google.charts is avaiable:
                if (typeof google == 'undefined' || typeof google.charts == 'undefined') {
                    $log.error('google.charts not loaded');
                    return;
                }

                google.charts.load('current', {'packages': ['corechart']});
                google.charts.setOnLoadCallback(drawChart);

                function drawChart() {
                    $log.debug('drawChart started');

                    var dataArray = [['Shareholder Account', 'shares']].concat($scope.shareholdersBalancesArray);
                    $log.info(dataArray);

                    var data = google.visualization.arrayToDataTable(
                        dataArray
                    );

                    var options = {title: 'Shares'};
                    var chart = new google.visualization.PieChart(document.getElementById('piechart'));
                    chart.draw(data, options);
                }

                // $timeout($rootScope.progressbar.complete(), 1000);
                $rootScope.progressbar.complete(); // <<< ---
            }; // end of $scope.drawPieChart();
            // --- RUN:
            $scope.drawPieChart();

            $scope.shareholderIdByAddress = {};
            $scope.getShareholderIdByAddress = function (shareholderAddress) { //
                $scope.contract.shareholderID.call(shareholderAddress).then(function (id) { // array
                        $scope.shareholderIdByAddress[shareholderAddress] = id;
                        $scope.$apply(); // <<< needed
                        $log.debug('shareholderAddress: ' + shareholderAddress);
                        $log.log($scope.shareholderIdByAddress[shareholderAddress]);
                        return $scope.shareholderIdByAddress[shareholderAddress];
                    }
                ).catch(function (error) {
                        $scope.alertDanger = error.toString();
                        $log.error(error);
                        return error;
                    }
                );
            };

            /* ######################## CONTRACT FUNCTIONS: */
            $scope.transactions = [];
            //
            $scope.transfer = function () {
                $rootScope.progressbar.start(); // <<<<<<<<<<<
                $rootScope.progressbar.set(35);
                var txParameters = {};
                txParameters.from = $scope.web3.eth.defaultAccount;
                //noinspection JSUnresolvedFunction
                $scope.contract.transfer(
                    $scope.transferTo.toString(),
                    parseInt($scope.transferValue),
                    txParameters
                )
                    .then(function (tx_id) {

                            $scope.refreshBalances(); //
                            $scope.drawPieChart(); // refreshes all token balances;

                            $scope.lastTxId = tx_id;
                            $scope.transactions.push(tx_id);
                            $scope.$apply();
                            $timeout($rootScope.progressbar.complete(), 1000);
                            return tx_id;
                        }
                    ).catch(function (error) {
                        $scope.alertDanger = error.toString();
                        $log.error(error);
                        $timeout($rootScope.progressbar.complete(), 1000);
                        return error;
                    }
                )

            }; // end of $scope.transfer()

            /* ------------- VOTING: */

            $scope.proposals = [];
            $scope.getAllProposals = function () {
                var id = 0;
                var proposalText; // (description)
                while (true) { //
                    try {
                        proposalText = web3Contract.proposalText.call(id);
                        if (proposalText != '0x') { // on TestNet and MainNet
                            $scope.proposals[id] = {};
                            $scope.proposals[id]['id'] = id;
                            $scope.proposals[id]['description'] = proposalText;
                            var unix_timestamp = web3Contract.deadline.call(id).toNumber();
                            $scope.proposals[id]['deadline'] = new Date(unix_timestamp * 1000);
                            $scope.proposals[id]['results'] = web3Contract.results.call(id).toNumber();
                            $scope.proposals[id]['finished'] = false; // ?
                            $scope.proposals[id]['votes'] = 'not calculated'; // ? 
                        } else {
                            break;
                        }
                        id++;
                    } catch (error) {  // on TestRPC
                        $log.error(error);
                        break;
                    }
                }
                // $scope.$apply(); // NOT HERE
                $log.debug('getAllProposals');
                $log.log($scope.proposals);
            }; // end of getAllProposals();
            // ----- RUN:
            $scope.getAllProposals();

            $scope.makeNewProposal = function (newProposalDescription, newDebatingPeriodInMinutes) {
                $rootScope.progressbar.start(); // <<<<<<<<<<<
                $rootScope.progressbar.set(35);
                var txParameters = {};
                txParameters.from = $scope.web3.eth.defaultAccount;

                if (!$scope.allShareholdersArray.includes(txParameters.from)) {
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
                            return tx_id;
                        }
                    ).catch(function (error) {
                        $scope.alertDanger = '[Make new proposal]' + error.toString();
                        $log.error(error);
                        $timeout($rootScope.progressbar.complete(), 1000);
                        return error;
                    }
                )
            }; // end of $scope.makeNewProposal()

            //
            $scope.voteForProposal = function (proposalID) {
                $rootScope.progressbar.start(); // <<<<<<<<<<<
                $rootScope.progressbar.set(35);
                var txParameters = {};
                txParameters.from = $scope.web3.eth.defaultAccount;
                if (!$scope.allShareholdersArray.includes(txParameters.from)) {
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
                )
            }; // end of $scope.voteForProposal()

            //
            $scope.countVotes = function (proposalID) {
                $rootScope.progressbar.start(); // <<<<<<<<<<<
                $rootScope.progressbar.set(35);
                var txParameters = {};
                txParameters.from = $scope.web3.eth.defaultAccount;
                $scope.contract.countVotes(
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
                        $scope.alertDanger = '[Count Votes]' + error.toString();
                        $log.error(error);
                        $timeout($rootScope.progressbar.complete(), 1000);
                        return error;
                    }
                )
            }; // end of $scope.countVotes()

            // ----- voting events:
            var VotingFinishedEvent = web3Contract.VotingFinished({fromBlock: 0, toBlock: 'latest'});
            // would get all past logs again.
            var myResults = VotingFinishedEvent.get(function (error, logs) {
                if (error) {
                    $log.error(error);
                } else if (logs) {
                    $log.info('myResults (VotingFinishedEvent) logs:');
                    $log.log(logs)
                }
            });
            $log.info('myResults (VotingFinishedEvent) ALL:');
            $log.log(myResults);

            /* ------------- EVENTS: */
            var events = web3Contract.allEvents({fromBlock: 0, toBlock: 'latest'});
            $scope.events = [];
            events.watch(function (error, result) {
                    if (error) {
                        $log.error(error);
                    } else if (result) {
                        $scope.events.push(result);
                        if (result.event == 'ProposalAdded') {
                            $scope.proposals[result.args.proposalID.toNumber()]['initiator'] = result.args.initiator;
                        } else if (result.event == 'VotingFinished') {
                            $scope.proposals[result.args.proposalID.toNumber()]['votes'] = result.args.votes.toNumber();
                            $scope.proposals[result.args.proposalID.toNumber()]['finished'] = true;
                        }
                        $scope.$apply(); // <<< needed here!!! 
                        $log.info('events.watch:');
                        $log.log(result);
                    }
                }
            );

        } // end of function smartContractCtrl
    ]
);

