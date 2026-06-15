const BREVO_API_KEY = process.env.BREVO_API_KEY;
const PRODUCT_ID = "prod_UgF61CQ5d70XJY";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

async function getLineItems(sessionId) {
  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}/line_items?expand[]=data.price.product`,
    {
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      },
    }
  );
  return response.json();
}

async function sendWelcomeEmail(customerEmail, customerName) {
  const firstName = customerName ? customerName.split(" ")[0] : null;
  const greeting = firstName ? `Olá, ${firstName}!` : "Olá!";

  const emailBody = `${greeting}

Thank you so much for signing up for the Rio Carnival Masterclass 2027! I'm truly excited to have you on board for this new edition.

Over the course of our sessions, we'll dive deep into the world of Rio's samba schools, exploring the history, music, creativity, and cultural power behind Brazil's culture. Whether you're returning or joining for the first time, I promise you an engaging and enriching experience.

You'll receive the Zoom link and all other details one week before our first class. Until then, feel free to reach out if you have any questions or just want to say hi!

Let's get ready for Carnival 2027!

Abraços,
Gabriel Lopes`;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: "Gabriel Lopes | Samba Beats",
        email: "mai@sambabeats.com.br",
      },
      to: [{ email: customerEmail, name: customerName || customerEmail }],
      subject: "Samba Beats - Welcome to the Rio Carnival Masterclass 2027",
      textContent: emailBody,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo error: ${error}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let event;
try {
  event = req.body;
} catch (err) {
  return res.status(400).json({ error: "Invalid JSON" });
}

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    if (session.payment_status !== "paid") {
      return res.status(200).json({ received: true, skipped: "not paid" });
    }

    const lineItemsData = await getLineItems(session.id);
    const hasProduct = lineItemsData.data?.some(
      (item) => item.price?.product?.id === PRODUCT_ID
    );

    if (!hasProduct) {
      return res.status(200).json({ received: true, skipped: "wrong product" });
    }

    const customerEmail = session.customer_details?.email;
    const customerName = session.customer_details?.name;

    if (!customerEmail) {
      return res.status(200).json({ received: true, skipped: "no email" });
    }

    try {
      await sendWelcomeEmail(customerEmail, customerName);
      console.log(`Welcome email sent to ${customerEmail}`);
    } catch (err) {
      console.error("Failed to send email:", err.message);
      return res.status(500).json({ error: "Failed to send email" });
    }
  }

  return res.status(200).json({ received: true });
}
