document.querySelectorAll('.faq-q').forEach(b => b.addEventListener('click', () => b.closest('.faq-item').classList.toggle('open')));

const watchVideoBtn = document.getElementById("watchVideoBtn");

const videoModal = document.getElementById("videoModal");

const closeVideo = document.getElementById("closeVideo");

const howVideo = document.getElementById("howVideo");


watchVideoBtn?.addEventListener("click", function (e) {

    e.preventDefault();

    videoModal.classList.add("show");

    howVideo.play();

});


closeVideo?.addEventListener("click", function () {

    videoModal.classList.remove("show");

    howVideo.pause();

    howVideo.currentTime = 0;

});


videoModal?.addEventListener("click", function (e) {

    if (e.target === videoModal) {

        videoModal.classList.remove("show");

        howVideo.pause();

        howVideo.currentTime = 0;

    }

});
const counters = document.querySelectorAll(".counter");


const observer = new IntersectionObserver(entries => {

    entries.forEach(entry => {

        if (entry.isIntersecting) {

            const counter = entry.target;

            const target = +counter.dataset.target;

            let count = 0;


            const update = () => {

                const speed = target / 80;


                if (count < target) {

                    count += Math.ceil(speed);

                    counter.innerText = count;

                    setTimeout(update, 20);

                }
                else {

                    counter.innerText = target;

                }

            };


            update();

            observer.unobserve(counter);

        }

    });


}, { threshold: .5 });



counters.forEach(counter => {

    observer.observe(counter);

});

const mainBox = document.querySelector(".main-image-box");


function changeImage(src) {

    mainBox.innerHTML = `

<img 
class="main-media"
src="${src}"
alt="SAFE ESCAPE">


<div class="video-overlay">

<button onclick="changeVideo()">
▶
</button>

<span>
Watch Product Video
<br>
30 Sec
</span>

</div>

`;

}



function changeVideo() {

    mainBox.innerHTML = `

        <iframe
            class="main-media"
            src="https://www.youtube.com/embed/l6DJYVeE4G0?autoplay=1&mute=0&loop=1&playlist=l6DJYVeE4G0&controls=1&rel=0&playsinline=1"
            title="SAFE ESCAPE Product Video"
            frameborder="0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowfullscreen>
        </iframe>


        <div class="video-overlay">

            <button>
                ▶
            </button>

            <span>
                Watch Product Video
                <br>
                30 Sec
            </span>

        </div>

    `;

}