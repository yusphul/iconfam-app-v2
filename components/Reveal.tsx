'use client';
import {useEffect} from 'react';
export default function Reveal(){useEffect(()=>{const els=[...document.querySelectorAll<HTMLElement>('[data-reveal]')];const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -40px'});els.forEach(el=>io.observe(el));return()=>io.disconnect()},[]);return null}
