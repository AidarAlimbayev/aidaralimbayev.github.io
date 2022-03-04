jQuery(document).ready(function() {

    jQuery(".anchor").on("click", function (event) {

        event.preventDefault();
        
        var id = jQuery(this).attr('href'),
        
        top = jQuery(id).offset().top;
        
        jQuery('body,html').animate({scrollTop: top}, 800);
    });

    jQuery(".top").on("click", function(event) {
        event.preventDefault();
        jQuery('body,html').animate({scrollTop: 0}, 800);
    })

    jQuery(".rs_block .head").on("click", function(event) {
        event.preventDefault();
        if(!jQuery(this).parent(".rs_block").hasClass("active")) {
            jQuery(".rs_block").removeClass("active")
            jQuery(".rs_block .body").hide(600)

            jQuery(this).siblings(".body").show(600)
            jQuery(this).parent(".rs_block").addClass("active")
        }
    })
    jQuery("form").on("submit", function(event) {
        event.preventDefault()
        let msg = `From:${jQuery("#your-name").val()} \n Message: ${jQuery("#message").val()}`

        let success = true
        // Email.send({
        //     SecureToken : '',
        //     To : '',
        //     From : jQuery("#your-email").val()
        //     Subject : "From my cv site site.com",
        //     Body : msg
        // }).then(
        //   message => alert(message)
        // );

        //emailjs.send('gmail', 'base', templateParams)



        if(success) {
            jQuery(".info_msg").text("Your message was sent successfully")
            jQuery(".info_msg").css('color','green')
            alert("Your message was sent successfully")
        } else {
            jQuery(".info_msg").text("Oops, something went wrong :( ... Try later")
            jQuery(".info_msg").css('color','red')
        }
    })


    jQuery(".cookie_ok").on("click", function(event) {
        event.preventDefault()      
        localStorage.setItem("cookie_ok", true)
        jQuery(".cookies_alert").hide()
    })

    if(!localStorage.getItem("cookie_ok")) {
        jQuery(".cookies_alert").show()
    }



})

