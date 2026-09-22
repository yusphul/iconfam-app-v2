'use client'
import Link from 'next/link'; import Logo from './Logo';
export default function Nav(){return <header className="nav"><Link href="/"><Logo/></Link><nav><Link className="active" href="/">Home</Link><a href="/#how">How It Works</a><a href="/#services">Services</a><a href="/#about">About</a><a href="/#projects">Projects</a><Link href="/auth">Sign In</Link></nav><Link className="btn small" href="/auth?mode=signup">Get Started →</Link></header>}
