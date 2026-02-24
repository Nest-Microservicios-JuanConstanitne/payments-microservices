import { ClientProxy } from '@nestjs/microservices';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { envs } from '../config/envs';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';
import { NATS_SERVICES } from 'src/config';

@Injectable()
export class PaymentsService {

  constructor(
    @Inject(NATS_SERVICES) private readonly client: ClientProxy
  ) { }

  private readonly stripe = new Stripe(envs.stripeSecret);

  private readonly logger = new Logger("PaymentService");

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {

    const { currency, items, orderId } = paymentSessionDto;

    const lineItems = items.map(item => {
      return {
        price_data: {
          currency: currency,
          product_data: {
            name: item.name
          },
          unit_amount: Math.round(item.price * 100) // 20 dolares  200 / 100 = 20.00 VALOR EN ENTERO\
        },
        quantity: item.quantity
      }
    });

    const session = await this.stripe.checkout.sessions.create({
      payment_intent_data: {
        metadata: {
          orderId: orderId
        },
      },

      line_items: lineItems,
      mode: 'payment',
      success_url: envs.stripeSuccessUrl,
      cancel_url: envs.stripeCancelUrl
    });

    //return session;

    return {
      cancelUrl: session.cancel_url,
      succesUrl: session.success_url,
      url: session.url
    }

  }

  async stripeWebhook(req: Request, res: Response) {

    /* const payload = {
      stripePaymentId: 'ch_3T44YOEcgjn4ueey1M6Tm3h7',
      orderId: '3fb60f93-37b9-41ad-b578-fc9983839ec0',
      receipUrl: 'https://pay.stripe.com/receipts/payment/CAcaFwoVYWNjdF8xVDNxbDNFY2dqbjR1ZWV5KJjN8swGMgbdogwPST46LBahLHOYDggPIhoY0T0jtIAPdDvKTFc6WFIDFOSKA2WTwOp8Wp-yC6GdgEZY'
    }

    this.client.emit('payment.succeeded', payload);

    return res.status(200).json({ received: true }); */


    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    //const endpointSecret = 'whsec_8EjdzblHd91ngu27KZ4BknHhRFFUKkhF';
    const endpointSecret = envs.stripeEndpointSecret;
    //const endpointSecret = 'whsec_63b159adefb1a95529e5f5b3737f0756422e8b687268e26d8b576ae2532c360d';

    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'], // 👈 ahora sí existe
        sig,
        endpointSecret,
      );

    } catch (err) {
      console.log(err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'charge.succeeded':
        const chargeSucceeded = event.data.object as Stripe.Charge;

        const payload = {
          stripePaymentId: chargeSucceeded.id,
          orderId: chargeSucceeded.metadata.orderId,
          receipUrl: chargeSucceeded.receipt_url
        }

        // Emitir evento a OrderMS
        this.client.emit('payment.succeeded', payload);
        break;

      default:
        console.log(`Event ${event.type} not handled`);
    }

    return res.status(200).json({ received: true });
  }

}
