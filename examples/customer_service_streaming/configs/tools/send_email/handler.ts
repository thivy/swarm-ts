export function sendEmail(emailAddress: string, message: string): { response: string } {
  const response = `email sent to: ${emailAddress} with message: ${message}`;
  return { response };
}
