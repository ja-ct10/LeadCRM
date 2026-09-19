import { NextResponse } from 'next/server';
function disabled() { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
export { disabled as GET, disabled as POST };
