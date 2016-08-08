//var  bodyheight=window.innerHeight;
//if (window.innerHeight>720) bodyheight = 720;
//else if (window.innerHeight<520) 
bodyheight = 520;// else bodyheight=window.innerHeight;
$(function () {
    $(".watch").fancybox({
        'transitionIn': 'none',
        'transitionOut': 'none'
    });

    //$("#canvas").css('height', bodyheight+"px");
    //$("header .container .banner").css('height', (bodyheight-130)+"px");

    /* ----------- !!!! -- Begin: scroll effects removed  */
    /*
    function parallaxScroll() {
        var scrolled = $(window).scrollTop();

        if (scrolled > 200) $('#top').addClass('fixed');
        else $('#top').removeClass('fixed');

        /!*if (($(window).outerHeight()+scrolled)>1128 && scrolled<1609 && $(window).outerHeight()>1200) $('.parallaks-2').css('top',( ($(window).outerHeight()+scrolled)*.50+1260 )+'px');
         if (($(window).outerHeight()+scrolled)>1130 && scrolled<1610 && $(window).outerHeight()<=480) {
         $('.parallaks-2').css('top',( ($(window).outerHeight()+scrolled)*.700+0 )+'px');
         }
         if (($(window).outerHeight()+scrolled)>1130 && scrolled<1610 && $(window).outerHeight()>480 && $(window).outerHeight()<=620) {
         $('.parallaks-2').css('top',( ($(window).outerHeight()+scrolled)*.60+80 )+'px');
         }
         if (($(window).outerHeight()+scrolled)>1130 && scrolled<1610 && $(window).outerHeight()>620 && $(window).outerHeight()<=750) {
         $('.parallaks-2').css('top',( ($(window).outerHeight()+scrolled)*.50+190 )+'px');
         }
         if (($(window).outerHeight()+scrolled)>1130 && scrolled<1610 && $(window).outerHeight()>750 && $(window).outerHeight()<=825) {
         $('.parallaks-2').css('top',( ($(window).outerHeight()+scrolled)*.45+250 )+'px');
         }
         if (($(window).outerHeight()+scrolled)>1130 && scrolled<1610 && $(window).outerHeight()>825 && $(window).outerHeight()<=940) {
         $('.parallaks-2').css('top',( ($(window).outerHeight()+scrolled)*.40+310 )+'px');
         }
         if (($(window).outerHeight()+scrolled)>1130 && scrolled<1610 && $(window).outerHeight()>940 && $(window).outerHeight()<=1100) {
         $('.parallaks-2').css('top',( ($(window).outerHeight()+scrolled)*.3+430 )+'px');
         }
         if (($(window).outerHeight()+scrolled)>1130 && scrolled<1610 && $(window).outerHeight()>940 && $(window).outerHeight()<=1940) {
         $('.parallaks-2').css('top',( ($(window).outerHeight()+scrolled)*.2+550 )+'px');
         }
         console.info('scrolled '+scrolled+' height '+$(window).outerHeight()+'  '+($(window).outerHeight()+scrolled));*!/
    }

    $(window).bind('scroll', function (e) {
        parallaxScroll();
    });

    $(window).trigger('scroll');

*/

/*    $(window).bind('scroll', function (e) {
        var scrolled = $(window).scrollTop();
        if (scrolled > 600 && $('nav').is(":hidden")) $('nav').fadeIn("slow");
        if (scrolled < 600 && $('nav').is(":visible")) $('nav').fadeOut("slow");
    });

    $(window).trigger('scroll');
    /!*$('.scroll').click(function(event){
     event.preventDefault();
     $('html,body').scrollTo(this.hash, this.hash, {gap: {y: -60}});
     return false;
     });*!/
    $('.links').onePageNav({
        currentClass: 'active',
        changeHash: false,
        scrollSpeed: 750
    });*/

    /* ---- End: croll removed */


    $(document).on('click', '.plus', function () {
        $('input[name=quantity]').val(parseInt($('input[name=quantity]').val()) + 1);
    });
    $(document).on('click', '.minus', function () {
        if (parseInt($('input[name=quantity]').val()) > 1) {
            $('input[name=quantity]').val(parseInt($('input[name=quantity]').val()) - 1);
        } else {
            $('input[name=quantity]').val(1);
        }
    });
    /*$('.fixed .logo').click(function(){
     $('html,body').scrollTo('#header', '#header', {gap: {y: -20}});
     });*/
    $('[name="phone"]').mask('+7 (999) 999-99-99');
    $(".modal").fancybox();

    $('input[type=text], input[type=email]').focus(function (event) {
        event.preventDefault();
        $(this).attr('placeholder2', $(this).attr('placeholder'));
        $(this).attr('placeholder', '');
        return false;
    });
    $('input[type=text], input[type=email]').blur(function (event) {
        event.preventDefault();
        $(this).attr('placeholder', $(this).attr('placeholder2'));
        return false;
    });
    $('#slides').slides({
        //effect: 'slide',
        //preload: true,
        //hoverPause: true,
        //play: 10000,
        //pause: 100,
        //pagination: false,
        //generatePagination: false
        //generateNextPrev: true
    });


    $(document).on('click', '#try .img img', function () {
        $('#try .image img').attr('src', $(this).attr('src'));
    });
    $('.try.btn').click(function () {
        $('#try .form-name').text($(this).parent().find('.title').text());
        $('#try .form-price').text($(this).parent().find('.price').text());
        $('#try .images').html($(this).parent().find('.images').html());
        //console.info($(this).parent().find('.title').text());
    });

    $('.get.btn, .buy.btn').click(function () {
        $('#buy-product input[name=prod-name]').val($('#try .form-name').text());
        $('#buy-product input[name=prod-quantity]').val($('#try input[name=quantity]').val());
        $.fancybox($('#buy-product'));
    });


    $("#form-1").bind("submit", function (event) {
        event.preventDefault();
        $.ajax({
            type: "POST",
            cache: false,
            url: "ajax/mail.php",
            data: $(this).serializeArray(),
            success: function (data) {
                $('#form-1').html(data);
            }
        });
        return false;
    });

    $("#form-2").bind("submit", function (event) {
        event.preventDefault();
        $.ajax({
            type: "POST",
            cache: false,
            url: "ajax/mail.php",
            data: $(this).serializeArray(),
            success: function (data) {
                $.fancybox($('#thank-you'));
                $('#form-2').trigger('reset');
            }
        });
        return false;
    });

    $("#form-3").bind("submit", function (event) {
        event.preventDefault();
        $.ajax({
            type: "POST",
            cache: false,
            url: "ajax/mail.php",
            data: $(this).serializeArray(),
            success: function (data) {
                $.fancybox($('#thank-you'));
                $('#form-3').trigger('reset');
            }
        });
        return false;
    });


    $("#form-4").bind("submit", function (event) {
        event.preventDefault();
        $.fancybox.showLoading();
        $.ajax({
            type: "POST",
            cache: false,
            url: "ajax/mail.php",
            data: $(this).serializeArray(),
            success: function (data) {
                $.fancybox($('#thank-you'));
            }
        });
        return false;
    });


    $("#form-5").bind("submit", function (event) {
        event.preventDefault();
        $.fancybox.showLoading();
        $.ajax({
            type: "POST",
            cache: false,
            url: "ajax/mail.php",
            data: $(this).serializeArray(),
            success: function (data) {
                $.fancybox($('#thank-you'));
            }
        });
        return false;
    });


    /*	$(".why .title").pxgradient({ //произвольный селектор jQuery
     step: 2, // размер шага градиента в пикселях. Меньше шаг — больше качество, но меньше производительность
     colors: ["#fff","#ddd"], // цвета. формат — hex (#4fc05a или #333)
     dir: "y" // направление градиента. x — горизонтальное, y — вертикальное
     });
     $(".btn span").pxgradient({ //произвольный селектор jQuery
     step: 2, // размер шага градиента в пикселях. Меньше шаг — больше качество, но меньше производительность
     colors: ["#fff","#c6c6c6"], // цвета. формат — hex (#4fc05a или #333)
     dir: "y" // направление градиента. x — горизонтальное, y — вертикальное
     });
     $(".grad").pxgradient({ //произвольный селектор jQuery
     step: 2, // размер шага градиента в пикселях. Меньше шаг — больше качество, но меньше производительность
     colors: ["#fff","#c6c6c6"], // цвета. формат — hex (#4fc05a или #333)
     dir: "y" // направление градиента. x — горизонтальное, y — вертикальное
     });*/
    /*    $('#timer').countdown({
     image: 'images/digits.png',
     startTime: '04:57:42',
     format: 'hh:mm:ss'
     });*/

    /*   $('#timer-2').countdown({
     image: 'images/digits.png',
     startTime: '04:57:42',
     //          timerEnd: function(){ alert('end!'); },
     format: 'hh:mm:ss'
     });*/

    /*$(".header .logo").click(function(){
     $(".order-logo").trigger("click");
     });
     $(".footer .logo").click(function(){
     $(".order-logo").trigger("click");
     });


     $('.services .item .order').click(function(){
     $('#order input[name=type]').val('заказ услуги '+$(this).parent().find('.title').text());
     });

     $('.readmore').click(function(){
     $('#readmore').html($(this).parent().find('.readmore-text').html());
     });

     $('.results .item .image').click(function(){
     $(this).parent().find('.readmore').trigger('click');
     });

     $("#slider-sale").slider({
     range: "min",
     min: 500,
     max: 50000,
     step: 500,
     value: 5000,
     slide: function( event, ui ) {
     calc('sale', ui.value);
     }
     });

     $("#slider-invest").slider({
     range: "min",
     min: 10000,
     max: 500000,
     step: 1000,
     value: 100000,
     slide: function( event, ui ) {
     calc('invest', ui.value);
     }
     });

     $("#slider-ctr").slider({
     range: "min",
     min: 1,
     max: 100,
     step: 1,
     value: 15,
     slide: function( event, ui ) {
     calc('ctr', ui.value);
     }
     });

     $("#slider-cpc").slider({
     range: "min",
     min: 1,
     max: 1000,
     step: 1,
     value: 100,
     slide: function( event, ui ) {
     calc('cpc', ui.value);
     }
     });

     function calc(type, value){
     var profit, maxprofit, boxprofit, boxloss,
     sale = $( "#slider-sale" ).slider( "option", "value" ),
     invest = $( "#slider-invest" ).slider( "option", "value" ),
     ctr = $( "#slider-ctr" ).slider( "option", "value" ),
     cpc = $( "#slider-cpc" ).slider( "option", "value" );
     switch (type){
     case 'sale':
     sale = value;
     break
     case 'invest':
     invest = value;
     break
     case 'ctr':
     ctr = value;
     break
     case 'cpc':
     cpc = value;
     break
     }
     //maxsale = $( "#slider-sale" ).slider( "option", "max" ),
     //maxinvest = $( "#slider-invest" ).slider( "option", "max" );
     //maxctr = $( "#slider-ctr" ).slider( "option", "max" ),
     //mincpc = $( "#slider-cpc" ).slider( "option", "min" )

     profit = Math.round(
     ( invest / cpc ) * ( ctr / 100 ) * sale
     );

     //maxprofit = ( maxinvest / mincpc ) * ( maxctr / 100 ) * maxsale;
     boxprofit =  Math.min(260, (260 * profit) / 1000000);
     boxloss =  Math.min(260, (260 * invest) / 1000000);
     total = profit - invest;

     $( "#amount-sale b" ).text( sale );
     $( "#amount-invest b" ).text(  invest );
     $( "#amount-ctr b" ).text( ctr );
     $( "#amount-cpc b" ).text( cpc );
     $( "#profit b" ).text( profit );
     $( "#loss b" ).text( invest );
     $( "#box-profit" ).height( boxprofit );
     $( "#box-loss" ).height( boxloss );
     $( "#total b" ).text( total );
     }
     calc();

     $("#form-2").bind("submit", function(event) {
     event.preventDefault();
     $.ajax({
     type	: "POST",
     cache	: false,
     url		: "ajax/mail.php",
     data	: $(this).serializeArray(),
     success: function(data) {
     $('#form-2').html(data);
     }
     });
     return false;
     });

     $("#form-3").bind("submit", function(event) {
     event.preventDefault();
     $.ajax({
     type	: "POST",
     cache	: false,
     url		: "ajax/mail.php",
     data	: $(this).serializeArray(),
     success: function(data) {
     $('#form-3').html(data);
     }
     });
     return false;
     });

     $("#form-4").bind("submit", function(event) {
     event.preventDefault();
     $.ajax({
     type	: "POST",
     cache	: false,
     url		: "ajax/mail.php",
     data	: $(this).serializeArray(),
     success: function(data) {
     $('#form-4').html(data);
     }
     });
     return false;
     });

     $("#form-5").bind("submit", function(event) {
     event.preventDefault();
     $.ajax({
     type	: "POST",
     cache	: false,
     url		: "ajax/mail.php",
     data	: $(this).serializeArray(),
     success: function(data) {
     $('#form-5').html(data);
     }
     });
     return false;
     });

     $("#form-6").bind("submit", function(event) {
     event.preventDefault();
     $.ajax({
     type	: "POST",
     cache	: false,
     url		: "ajax/mail.php",
     data	: $(this).serializeArray(),
     success: function(data) {
     $('#form-6').html(data);
     }
     });
     return false;
     });


     $("#form-7").bind("submit", function(event) {
     event.preventDefault();
     $.fancybox.showLoading();
     $.ajax({
     type	: "POST",
     cache	: false,
     url		: "ajax/mail.php",
     data		: $(this).serializeArray(),
     success: function(data) {
     $.fancybox(data);
     }
     });
     return false;
     });

     $("#form-8").bind("submit", function(event) {
     event.preventDefault();
     $.fancybox.showLoading();
     $.ajax({
     type	: "POST",
     cache	: false,
     url		: "ajax/mail.php",
     data		: $(this).serializeArray(),
     success: function(data) {
     $.fancybox(data);
     }
     });
     return false;
     });

     $("#form-9").bind("submit", function(event) {
     event.preventDefault();
     $.fancybox.showLoading();
     $.ajax({
     type	: "POST",
     cache	: false,
     url		: "ajax/mail.php",
     data		: $(this).serializeArray(),
     success: function(data) {
     $.fancybox(data);
     }
     });
     return false;
     });
     $("#form-10").bind("submit", function(event) {
     event.preventDefault();
     $.fancybox.showLoading();
     $.ajax({
     type	: "POST",
     cache	: false,
     url		: "ajax/mail.php",
     data		: $(this).serializeArray(),
     success: function(data) {
     $.fancybox(data);
     }
     });
     return false;
     });*/

});
/*
 ymaps.ready(init);

 function init () {
 var myMap = new ymaps.Map("map", {
 center: [56.326887, 44.005986],
 zoom: 15
 }),

 myPlacemark2 = new ymaps.Placemark([56.327887, 43.99586], {
 hintContent: 'HDleads'
 }, {
 iconImageHref: 'images/marker.png',
 iconImageSize: [38, 73],
 iconImageOffset: [-6, -60]
 });
 myMap.controls
 .add('zoomControl', { left: 5, top: 5 })
 .add('mapTools', { left: 35, top: 5 });
 myMap.geoObjects
 .add(myPlacemark2);
 }
 */


"use strict";

function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}

var canvas = document.getElementById("canvas"),
    context = canvas.getContext("2d"),
    width = canvas.width = window.innerWidth,
    height = canvas.height = bodyheight,
    densityX = 60,
    densityY = 40,
    devideX = Math.floor(width / densityX),
    devideY = Math.floor(height / densityY),
    largeSize = [1, 0, 1],
    middleSize = [0, 0],
    smallSize = [0, 0],
    colorPallet_1 = ["#fff", "#fff", "#fff", "#fff"],
    colorPallet_2 = ["#fff", "#fff", "#fff"],
    colorPallet_3 = ["#fff", "#fff"],
    originSpeed = .05,
    speed2 = 1.5;

var largeParticles = [],
    middleParticles = [],
    smallParticles = [],
    collision = false;

var Particle = function () {
    function Particle(x, y, size, color) {
        _classCallCheck(this, Particle);

        this.x = x;
        this.y = y;
        this.r = size;
        this.angle = Math.random() * Math.PI * 2;
        this.vx = originSpeed * Math.cos(this.angle);
        this.vy = originSpeed * Math.sin(this.angle);
        this.color = color;
    }

    Particle.prototype.update = function update() {
        if (this.x - this.r < 0 || this.x + this.r > width) {
            this.vx *= -1;
        } else if (this.y - this.r < 0 || this.y + this.r > height) {
            this.vy *= -1;
        }

        if (!collision) {
            //current velocity
            var cv = {s: this.currentSpeed(), a: this.currentAngle()};

            //easing
            if (originSpeed < cv.s) {
                this.vx -= Math.cos(cv.a) * (cv.s - originSpeed) * .1;
                this.vy -= Math.sin(cv.a) * (cv.s - originSpeed) * .1;
            }
        }

        this.x += this.vx;
        this.y += this.vy;
    };

    Particle.prototype.currentSpeed = function currentSpeed() {
        return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    };

    Particle.prototype.currentAngle = function currentAngle() {
        return Math.atan2(this.vy, this.vx);
    };

    return Particle;
}();

//set particles

for (var h = 0; h < devideY; h += 1) {
    for (var w = 0; w < devideX; w += 1) {
        //avoid collision
        var x = densityX * w + 40 + (densityX - 80) * Math.random(),
            y = densityY * h + 40 + (densityY - 80) * Math.random(),
            angle = Math.PI * 2 * Math.random(),
            randomNum = Math.floor(Math.random() * 3.5);
        if (randomNum === 0 || randomNum === 2) {
            largeParticles.push(new Particle(x, y, largeSize[Math.floor(Math.random() * largeSize.length)], colorPallet_1[Math.floor(Math.random() * colorPallet_1.length)]));
        }
        if (randomNum === 0 || randomNum === 1) {
            middleParticles.push(new Particle(x, y, middleSize[Math.floor(Math.random() * middleSize.length)], colorPallet_2[Math.floor(Math.random() * colorPallet_2.length)]));
        }
        if (randomNum === 1 || randomNum === 2) {
            smallParticles.push(new Particle(x, y, smallSize[Math.floor(Math.random() * smallSize.length)], colorPallet_3[Math.floor(Math.random() * colorPallet_3.length)]));
        }
    }
}

function checkDistance(array) {
    for (var i = 0, len = array.length; i < len - 1; i++) {
        for (var j = i + 1; j < len; j++) {
            var p0 = array[i],
                p1 = array[j],
                pDistance = (p1.x - p0.x) * (p1.x - p0.x) + (p1.y - p0.y) * (p1.y - p0.y),
                pAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

            if (pDistance < 7500 && array === largeParticles || pDistance < 5000 && array === middleParticles || pDistance < 3000 && array === smallParticles) {
                context.globalAlpha = .4;

                if (array === largeParticles) {
                    // context.strokeStyle = "#fff";
                    // context.strokeStyle = "#888";
                    // context.strokeStyle = "#535C65";
                    context.strokeStyle = "#727272";
                } else if (array === middleParticles) {
                    // context.strokeStyle = "#666";
                    // context.strokeStyle = "#555";
                    // context.strokeStyle = "#535C65";
                    context.strokeStyle = "#484848";
                } else if (array === smallParticles) {
                    // context.strokeStyle = "#333";
                    // context.strokeStyle = "222222";
                    context.strokeStyle = "#2E3843";
                }

                context.beginPath();
                context.moveTo(p0.x, p0.y);
                context.lineTo(p1.x, p1.y);
                context.stroke();
            }

            if (pDistance < (p0.r + p1.r) * (p0.r + p1.r)) {
                collision = true;
                p1.vx = Math.cos(pAngle) * speed2;
                p1.vy = Math.sin(pAngle) * speed2;
                p0.vx = -Math.cos(pAngle) * speed2;
                p0.vy = -Math.sin(pAngle) * speed2;
            } else {
                collision = false;
            }
        }
    }
}

function draw(array) {
    checkDistance(array);
    for (var i = 0, len = array.length; i < len; i++) {
        var p = array[i];
        p.update();
        context.globalAlpha = 1;
        context.fillStyle = p.color;
        context.beginPath();
        context.arc(p.x, p.y, p.r, 0, Math.PI * 2, false);
        context.fill();
    }
}

render();
function render() {
    context.clearRect(0, 0, width, height);
    draw(smallParticles);
    draw(middleParticles);
    draw(largeParticles);
    requestAnimationFrame(render);
}