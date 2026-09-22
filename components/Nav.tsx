'use client'
import Link from 'next/link'
export default function Nav(){return <header className="nav"><Link className="brand" href="/"><span className="mark">⌂</span><span>iConfam<small>Verify. Build. Invest with Confidence</small></span></Link><nav><a href="/#services">Services</a><a href="/#how">How It Works</a><a href="/#trust">Why iConfam</a><Link href="/auth">Sign in</Link><Link className="btn small" href="/auth?mode=signup">Get Started →</Link></nav></header>}
