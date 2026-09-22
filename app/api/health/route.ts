import {NextResponse} from 'next/server'; export async function GET(){return NextResponse.json({ok:true,service:'iconfam',time:new Date().toISOString()})}
