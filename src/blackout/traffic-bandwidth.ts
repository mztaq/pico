/** Network bandwidth is not the same as HTTP request count.
 * Convert the locally generated request/response sizes into an estimated
 * aggregate bit rate. No packets are sent outside this browser.
 */
export const DEFAULT_BYTES_PER_REQUEST=3*1024*1024;
export function estimatedBitsPerSecond(rps:number,bytesPerRequest=DEFAULT_BYTES_PER_REQUEST):number{
  if(!Number.isFinite(rps)||!Number.isFinite(bytesPerRequest))return 0;
  return Math.max(0,rps)*Math.max(0,bytesPerRequest)*8;
}
export function formatBandwidth(bitsPerSecond:number):string{
  const safe=Number.isFinite(bitsPerSecond)?Math.max(0,bitsPerSecond):0;
  return safe>=1e12?(safe/1e12).toFixed(2)+' Tbps':(safe/1e9).toFixed(2)+' Gbps';
}
export function throughputLabel(rps:number,bytesPerRequest=DEFAULT_BYTES_PER_REQUEST):string{
  return formatBandwidth(estimatedBitsPerSecond(rps,bytesPerRequest));
}
