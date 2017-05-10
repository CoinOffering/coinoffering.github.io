'use strict';

var app = angular.module('Corporation');

app.directive('navTabsDirective', function () {
    return {
        restrict: 'EA', //E = element, A = attribute, C = class, M = comment
        templateUrl: 'views/nav-tabs-directive.html'
    };
});

app.directive('priceChartDirective', function () {
    return {
        restrict: 'EA', //E = element, A = attribute, C = class, M = comment
        templateUrl: 'views/priceChart.directive.html'
    };
});