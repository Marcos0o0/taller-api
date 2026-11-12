function clientSearch(value) {
  const term = String(value).trim().slice(0, 150);
  const text = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const digits = term.replace(/\D/g, '');
  const phone =
    digits && /^[+\d\s()-]+$/.test(term) ? new RegExp(digits.split('').join('[\\s()+-]*')) : text;
  return {
    $or: [
      ...['firstName', 'lastName1', 'lastName2', 'email'].map((field) => ({ [field]: text })),
      { phone },
      {
        $expr: {
          $regexMatch: {
            input: {
              $concat: [
                { $ifNull: ['$firstName', ''] },
                ' ',
                { $ifNull: ['$lastName1', ''] },
                ' ',
                { $ifNull: ['$lastName2', ''] },
              ],
            },
            regex: text,
          },
        },
      },
    ],
  };
}
module.exports = clientSearch;
