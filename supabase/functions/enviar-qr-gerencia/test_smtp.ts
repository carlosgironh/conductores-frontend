import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts'

async function testSMTP() {
  const client = new SmtpClient();
  try {
    console.log("Connecting...");
    await client.connectTLS({
      hostname: "smtppro.zoho.com",
      port: 465,
      username: "support.roadto@nrdesingcorp.com",
      password: "Liaromero1809*",
    });
    console.log("Connected successfully!");
    
    await client.send({
      from: "support.roadto@nrdesingcorp.com",
      to: "gerencia@nrdesingcorp.com",
      subject: "Test email from Deno",
      content: "Hello world",
    });
    console.log("Email sent!");
    
    await client.close();
  } catch(e) {
    console.error("SMTP error:", e);
  }
}

testSMTP();
