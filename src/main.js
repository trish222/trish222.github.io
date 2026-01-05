import './style.css';

const menuBtn = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

menuBtn.addEventListener('click', () => {
  
  // toggle the 'off' classes
  mobileMenu.classList.toggle('invisible');
  mobileMenu.classList.toggle('opacity-0');
  mobileMenu.classList.toggle('scale-95');
  
  // toggle the 'on' classes
  mobileMenu.classList.toggle('visible');
  mobileMenu.classList.toggle('opacity-100');
  mobileMenu.classList.toggle('scale-100');
});