# Свой брокер лобби

Лобби всех игр ходят через MQTT по WebSocket (`shared/net.js`). Пока `OWN` там пустой, используются публичные зарубежные брокеры EMQX и HiveMQ. Этот каталог поднимает свой брокер на российском VPS: Mosquitto принимает соединения только на localhost, а Caddy выдаёт его наружу по `wss://` и сам получает сертификат.

## Что нужно

- VPS в России с Ubuntu 24.04: 1 vCPU, 1 ГБ RAM хватит на тысячи игроков (Timeweb Cloud, Selectel и т. п.).
- Домен. В DNS добавить A-запись `mqtt` → IP сервера.

## Установка

```bash
scp -r server/mqtt root@IP_СЕРВЕРА:/root/
ssh root@IP_СЕРВЕРА "bash /root/mqtt/setup.sh potenceval.ru"
```

Затем в `shared/net.js` впишите `const OWN = 'wss://mqtt.potenceval.ru/mqtt';`.

## Проверка

`https://mqtt.<домен>/` в браузере отвечает ошибкой 400 или 426: брокер жив, просто ждёт WebSocket. Потом откройте лобби в двух вкладках.

Журналы: `journalctl -u mosquitto -u caddy`.
